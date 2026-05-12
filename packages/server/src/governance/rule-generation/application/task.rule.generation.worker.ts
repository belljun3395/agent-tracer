import {
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type OnApplicationShutdown,
} from "@nestjs/common";
import { TaskRuleGenerationJobRepository } from "../repository/task.rule.generation.job.repository.js";
import { TaskRuleGenerationService } from "./task.rule.generation.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
const BATCH_SIZE = 2;

/**
 * Polls `task_rule_generation_jobs` for pending rows and dispatches each to
 * the rule generation service. Concurrency safe (atomic claim).
 *
 * Slower polling than the event worker since these jobs are user-triggered
 * and infrequent.
 */
@Injectable()
export class TaskRuleGenerationWorker
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    private readonly logger = new Logger(TaskRuleGenerationWorker.name);
    private timer: NodeJS.Timeout | null = null;
    private running = false;
    private shuttingDown = false;
    private idleTicks = 0;
    private currentIntervalMs = MIN_POLL_INTERVAL_MS;

    constructor(
        private readonly jobs: TaskRuleGenerationJobRepository,
        private readonly service: TaskRuleGenerationService,
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
        while (this.running && Date.now() - start < 30_000) {
            await new Promise((r) => setTimeout(r, 100));
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
            const pending = await this.jobs.findPending(BATCH_SIZE);
            if (pending.length === 0) {
                this.idleTicks++;
                if (this.idleTicks >= IDLE_TICKS_BEFORE_BACKOFF) {
                    this.currentIntervalMs = Math.min(
                        this.currentIntervalMs * 2,
                        MAX_POLL_INTERVAL_MS,
                    );
                }
                return;
            }
            this.idleTicks = 0;
            this.currentIntervalMs = MIN_POLL_INTERVAL_MS;
            for (const job of pending) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by onApplicationShutdown
                if (this.shuttingDown) break;
                const claimed = await this.jobs.claim(
                    job.id,
                    new Date().toISOString(),
                );
                if (!claimed) continue;
                this.logger.log(
                    `Starting rule generation: jobId=${claimed.id} taskId=${claimed.taskId}`,
                );
                await this.service.execute(claimed);
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
