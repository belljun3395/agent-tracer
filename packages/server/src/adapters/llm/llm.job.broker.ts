import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface LlmWireJob {
    readonly id: string;
    /** Agent label for logging, e.g. "rule-suggestion". */
    readonly kind: string;
    /** The AgentQueryRequest (API key stripped) — JSON-serializable for the wire. */
    readonly input: unknown;
    readonly enqueuedAt: number;
}

interface PendingJob {
    readonly job: LlmWireJob;
    readonly resolve: (output: unknown) => void;
    readonly reject: (err: Error) => void;
    readonly timer: NodeJS.Timeout;
    claimed: boolean;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
// Bound the in-flight set so a missing/wedged runtime worker can't grow the map
// without limit. Single-instance assumption (one server process); revisit if the
// server is ever horizontally scaled — the broker would need a shared backend.
const MAX_PENDING = 256;

/**
 * In-memory rendezvous between the server (which produces LLM jobs) and the
 * local runtime daemon (which pulls them, runs the Claude Agent SDK, and posts
 * results back). {@link RemoteQueryRunner} awaits the promise returned by
 * {@link enqueue}; {@link LlmJobController} drives {@link claimNext} / resolve.
 *
 * Only used when MONITOR_LLM_RUNNER=remote; otherwise it stays empty.
 */
@Injectable()
export class LlmJobBroker {
    private readonly logger = new Logger(LlmJobBroker.name);
    private readonly pending = new Map<string, PendingJob>();
    private readonly unclaimed: string[] = [];

    enqueue<TOutput>(
        kind: string,
        input: unknown,
        timeoutMs = DEFAULT_TIMEOUT_MS,
    ): Promise<TOutput> {
        if (this.pending.size >= MAX_PENDING) {
            return Promise.reject(
                new Error("LLM job broker at capacity — no runtime worker is draining jobs."),
            );
        }
        const id = randomUUID();
        const job: LlmWireJob = { id, kind, input, enqueuedAt: Date.now() };
        return new Promise<TOutput>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(
                    new Error(
                        `LLM job ${kind} (${id}) timed out after ${timeoutMs}ms — no runner result.`,
                    ),
                );
            }, timeoutMs);
            timer.unref();
            this.pending.set(id, {
                job,
                resolve: (output) => {
                    resolve(output as TOutput);
                },
                reject,
                timer,
                claimed: false,
            });
            this.unclaimed.push(id);
        });
    }

    /** Runtime worker pulls the next unclaimed job (FIFO), or null if none. */
    claimNext(): LlmWireJob | null {
        for (;;) {
            const id = this.unclaimed.shift();
            if (id === undefined) return null;
            const entry = this.pending.get(id);
            if (entry && !entry.claimed) {
                entry.claimed = true;
                return entry.job;
            }
        }
    }

    /** Runtime worker reports success. Returns false if the job is unknown/expired. */
    resolve(id: string, output: unknown): boolean {
        const entry = this.pending.get(id);
        if (!entry) return false;
        clearTimeout(entry.timer);
        this.pending.delete(id);
        entry.resolve(output);
        return true;
    }

    /** Runtime worker reports failure. Returns false if the job is unknown/expired. */
    reject(id: string, message: string): boolean {
        const entry = this.pending.get(id);
        if (!entry) return false;
        clearTimeout(entry.timer);
        this.pending.delete(id);
        this.logger.warn(`LLM job ${entry.job.kind} (${id}) failed on runner: ${message}`);
        entry.reject(new Error(message));
        return true;
    }
}
