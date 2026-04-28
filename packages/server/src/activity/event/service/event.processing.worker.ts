import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventProcessingJobEntity } from "~activity/event/domain/event-store/event.processing.job.entity.js";
import { TimelineEventService } from "./timeline.event.service.js";
import type { TimelineEvent } from "~activity/event/domain/model/timeline.event.model.js";
import { VERIFICATION_POST_PROCESSOR_PORT } from "../application/outbound/tokens.js";
import type { IVerificationPostProcessor } from "../application/outbound/verification.post.processor.port.js";

const POLL_INTERVAL_MS = 250;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 8;

/**
 * Polls `event_processing_jobs` for pending rows and dispatches each to the
 * verification post-processor. Replaces the previous inline call inside
 * LogEventUseCase so ingest latency is decoupled from rule-evaluation cost.
 *
 * Concurrency: claims jobs one at a time via an atomic
 * `update ... where status='pending' and job_id=?` (only one worker wins
 * per row, so multi-instance deployment is safe).
 */
@Injectable()
export class EventProcessingWorker implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(EventProcessingWorker.name);
    private timer: NodeJS.Timeout | null = null;
    private running = false;
    private shuttingDown = false;

    constructor(
        @InjectRepository(EventProcessingJobEntity)
        private readonly jobs: Repository<EventProcessingJobEntity>,
        private readonly events: TimelineEventService,
        @Inject(VERIFICATION_POST_PROCESSOR_PORT)
        private readonly verification: IVerificationPostProcessor,
    ) {}

    onApplicationBootstrap(): void {
        this.timer = setInterval(() => {
            void this.tick();
        }, POLL_INTERVAL_MS);
        // Allow process to exit even if timer is alive (e.g. tests)
        this.timer.unref();
    }

    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Wait briefly for any in-flight tick to finish
        const start = Date.now();
        while (this.running && Date.now() - start < 2000) {
            await new Promise((r) => setTimeout(r, 25));
        }
    }

    private async tick(): Promise<void> {
        if (this.running || this.shuttingDown) return;
        this.running = true;
        try {
            const pending = await this.jobs.find({
                where: { status: "pending" },
                order: { createdAt: "ASC" },
                take: BATCH_SIZE,
            });
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

    private async claim(jobId: string): Promise<EventProcessingJobEntity | null> {
        const now = new Date().toISOString();
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
                await this.markCompleted(job, "event missing — skipped");
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
                    await this.markCompleted(job, `unknown job_type: ${job.jobType}`);
                    return;
            }
            await this.markCompleted(job, null);
        }
        catch (err) {
            await this.markFailed(job, err);
        }
    }

    private async markCompleted(job: EventProcessingJobEntity, note: string | null): Promise<void> {
        await this.jobs.update(
            { jobId: job.jobId },
            {
                status: "completed",
                updatedAt: new Date().toISOString(),
                lastError: note,
            },
        );
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
                updatedAt: new Date().toISOString(),
                lastError: message,
            },
        );
        this.logger.warn(`job ${job.jobId} attempt ${attempts} failed: ${message}`);
    }
}
