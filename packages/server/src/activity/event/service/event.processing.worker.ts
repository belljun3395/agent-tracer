import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, Repository } from "typeorm";
import { EventProcessingJobEntity } from "~activity/event/domain/event-store/event.processing.job.entity.js";
import { TimelineEventService } from "./timeline.event.service.js";
import type { TimelineEvent } from "~activity/event/domain/model/timeline.event.model.js";
import { CLOCK_PORT, VERIFICATION_POST_PROCESSOR_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IVerificationPostProcessor } from "../application/outbound/verification.post.processor.port.js";

const MIN_POLL_INTERVAL_MS = 250;
const MAX_POLL_INTERVAL_MS = 2000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 8;
// A claimed job left in 'processing' longer than this — because the process
// crashed between claim() and markCompleted/markFailed — is presumed orphaned
// and reclaimed to 'pending' so its post-processing isn't lost forever.
const PROCESSING_VISIBILITY_TIMEOUT_MS = 60_000;
// Minimum wait before a failed/reclaimed job is retried, so a poison job that
// always throws can't hot-loop every poll tick and starve the connection.
const RETRY_BACKOFF_MS = 5_000;

/**
 * Polls `event_processing_jobs` for pending rows and dispatches each to the
 * verification post-processor. Replaces the previous inline call inside
 * LogEventUseCase so ingest latency is decoupled from rule-evaluation cost.
 *
 * Concurrency: claims jobs one at a time via an atomic
 * `update ... where status='pending' and job_id=?` (only one worker wins
 * per row, so multi-instance deployment is safe).
 *
 * Retention: completed jobs are deleted on success so the queue table stays
 * bounded. Permanently-failed rows (`status='failed'`, attempts hit MAX) are
 * kept for inspection.
 *
 * Idle backoff: after 10 consecutive empty polls the interval doubles up to
 * 2s. New ingest activity resets the interval to 250ms on the next non-empty
 * tick.
 */
@Injectable()
export class EventProcessingWorker implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(EventProcessingWorker.name);
    private timer: NodeJS.Timeout | null = null;
    private running = false;
    private shuttingDown = false;
    private idleTicks = 0;
    private currentIntervalMs = MIN_POLL_INTERVAL_MS;

    constructor(
        @InjectRepository(EventProcessingJobEntity)
        private readonly jobs: Repository<EventProcessingJobEntity>,
        private readonly events: TimelineEventService,
        @Inject(VERIFICATION_POST_PROCESSOR_PORT)
        private readonly verification: IVerificationPostProcessor,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    onApplicationBootstrap(): void {
        this.scheduleNext();
    }

    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const start = Date.now();
        while (this.running && Date.now() - start < 2000) {
            await new Promise((r) => setTimeout(r, 25));
        }
    }

    private scheduleNext(): void {
        if (this.shuttingDown) return;
        this.timer = setTimeout(() => {
            void this.tick().finally(() => this.scheduleNext());
        }, this.currentIntervalMs);
        this.timer.unref();
    }

    private async tick(): Promise<void> {
        if (this.running || this.shuttingDown) return;
        this.running = true;
        try {
            await this.reapStuck();
            // Fresh jobs (attempts 0) run immediately; failed/reclaimed jobs wait
            // RETRY_BACKOFF_MS (their updatedAt is stamped on failure) so a poison
            // job can't be re-fetched every tick. ISO timestamps sort lexically.
            const readyBefore = new Date(this.clock.nowMs() - RETRY_BACKOFF_MS).toISOString();
            const pending = await this.jobs.find({
                where: [
                    { status: "pending", attempts: 0 },
                    { status: "pending", updatedAt: LessThanOrEqual(readyBefore) },
                ],
                order: { createdAt: "ASC" },
                take: BATCH_SIZE,
            });
            if (pending.length === 0) {
                this.idleTicks++;
                if (this.idleTicks >= IDLE_TICKS_BEFORE_BACKOFF) {
                    this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, MAX_POLL_INTERVAL_MS);
                }
                return;
            }
            this.idleTicks = 0;
            this.currentIntervalMs = MIN_POLL_INTERVAL_MS;
            for (const job of pending) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by onApplicationShutdown
                if (this.shuttingDown) break;
                const claimed = await this.claim(job.jobId);
                if (!claimed) continue;
                await this.process(claimed);
            }
        }
        catch (err) {
            this.logger.error("worker tick failed", err instanceof Error ? err.stack : String(err));
        }
        finally {
            this.running = false;
        }
    }

    /**
     * Reclaim jobs stuck in 'processing' past the visibility timeout (the
     * process died between claim() and markCompleted/markFailed). Without this
     * the worker — which only ever selects status='pending' — would never
     * re-run them and the event's verification would be lost permanently.
     * attempts is bumped so a job that repeatedly crashes the worker still
     * reaches MAX_ATTEMPTS and is parked as 'failed' rather than looping.
     */
    private async reapStuck(): Promise<void> {
        const threshold = new Date(this.clock.nowMs() - PROCESSING_VISIBILITY_TIMEOUT_MS).toISOString();
        await this.jobs
            .createQueryBuilder()
            .update(EventProcessingJobEntity)
            .set({ status: "pending", attempts: () => "attempts + 1", updatedAt: this.clock.nowIso() })
            .where("status = :processing AND updated_at < :threshold", { processing: "processing", threshold })
            .execute();
    }

    private async claim(jobId: string): Promise<EventProcessingJobEntity | null> {
        const now = this.clock.nowIso();
        const result = await this.jobs
            .createQueryBuilder()
            .update(EventProcessingJobEntity)
            .set({ status: "processing", updatedAt: now })
            .where("job_id = :jobId AND status = :status", { jobId, status: "pending" })
            .execute();
        if (!result.affected) return null;
        return this.jobs.findOneBy({ jobId });
    }

    private async process(job: EventProcessingJobEntity): Promise<void> {
        try {
            const event = await this.events.findById(job.eventId);
            if (!event) {
                await this.markCompleted(job);
                return;
            }

            switch (job.jobType) {
                case "verification.user_message":
                    await this.verification.onUserMessage(event as unknown as TimelineEvent);
                    break;
                case "verification.assistant_response":
                    await this.verification.onAssistantResponse(event as unknown as TimelineEvent);
                    break;
                case "verification.other_event":
                    await this.verification.onOtherEvent(event as unknown as TimelineEvent);
                    break;
                default:
                    await this.markCompleted(job);
                    return;
            }
            await this.markCompleted(job);
        }
        catch (err) {
            await this.markFailed(job, err);
        }
    }

    private async markCompleted(job: EventProcessingJobEntity): Promise<void> {
        await this.jobs.delete({ jobId: job.jobId });
    }

    private async markFailed(job: EventProcessingJobEntity, err: unknown): Promise<void> {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = job.attempts + 1;
        const status: EventProcessingJobEntity["status"] = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        await this.jobs.update(
            { jobId: job.jobId },
            {
                status,
                attempts,
                updatedAt: this.clock.nowIso(),
                lastError: message,
            },
        );
        this.logger.warn(`job ${job.jobId} attempt ${attempts} failed: ${message}`);
    }
}
