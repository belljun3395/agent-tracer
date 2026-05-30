import { type Logger, type OnApplicationShutdown } from "@nestjs/common";
import { AdaptivePoll } from "./adaptive-poll.js";

/**
 * Shared poll → claim → process loop for the governance async-job workers.
 *
 * Every worker reads a `*_jobs` outbox table, atomically claims pending rows
 * (so only one worker processes a row) and dispatches each claimed job to its
 * service. The bookkeeping — single-flight `running` guard, graceful shutdown
 * drain, and the {@link AdaptivePoll} idle-backoff cadence — is identical
 * across workers and lives here; a subclass only supplies the job-specific
 * pieces (which rows are pending, how to claim one, and what to do with it).
 *
 * Subclasses keep their own thin `@Interval(...)` method that delegates to
 * {@link runTick} — the decorator must stay on the concrete class so each
 * worker registers a distinct named interval.
 */
export abstract class BaseJobWorker<TJob extends { readonly id: string }>
    implements OnApplicationShutdown
{
    protected abstract readonly logger: Logger;
    private running = false;
    private shuttingDown = false;
    private readonly poll: AdaptivePoll;

    protected constructor(
        private readonly batchSize: number,
        minIntervalMs: number,
        maxIntervalMs: number,
        idleTicksBeforeBackoff: number,
    ) {
        this.poll = new AdaptivePoll(minIntervalMs, maxIntervalMs, idleTicksBeforeBackoff);
    }

    /** Fetch up to `limit` pending jobs (status = pending), oldest first. */
    protected abstract findPending(limit: number): Promise<readonly TJob[]>;

    /** Atomically transition a pending job to processing; null if already claimed. */
    protected abstract claim(jobId: string, startedAt: string): Promise<TJob | null>;

    /** Run the claimed job to completion (the worker never throws past here). */
    protected abstract process(job: TJob): Promise<void>;

    /** Human-readable label for the start-of-processing log line. */
    protected abstract describe(job: TJob): string;

    // ScheduleModule clears the interval on shutdown but does not await an
    // in-flight tick — so we flip `shuttingDown` and drain `running` here.
    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        const start = Date.now();
        while (this.running && Date.now() - start < 30_000) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }

    /** One poll cycle. Subclasses call this from their `@Interval` method. */
    protected async runTick(): Promise<void> {
        if (this.running || this.shuttingDown) return;
        if (!this.poll.due(Date.now())) return;
        this.running = true;
        try {
            const pending = await this.findPending(this.batchSize);
            if (pending.length === 0) {
                this.poll.onIdle(Date.now());
                return;
            }
            this.poll.onWork();
            for (const job of pending) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by onApplicationShutdown
                if (this.shuttingDown) break;
                const claimed = await this.claim(job.id, new Date().toISOString());
                if (!claimed) continue;
                this.logger.log(`Starting ${this.describe(claimed)}`);
                await this.process(claimed);
            }
        } catch (err) {
            this.logger.warn(
                `Worker tick failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            this.running = false;
        }
    }
}
