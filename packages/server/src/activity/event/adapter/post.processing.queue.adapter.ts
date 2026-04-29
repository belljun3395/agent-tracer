import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventProcessingJobEntity } from "~activity/event/domain/event-store/event.processing.job.entity.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";
import type {
    IPostProcessingQueue,
    PostProcessingJobInput,
} from "../application/outbound/post.processing.queue.port.js";

/**
 * DB-backed durable post-processing queue. Each job lives in
 * `event_processing_jobs` until a worker claims and completes it.
 *
 * For multi-instance deployments this still works (workers race for
 * `pending → processing` transitions; only one wins per row). Future option:
 * swap with a Redis/BullMQ-backed adapter.
 */
@Injectable()
export class DbBackedPostProcessingQueue implements IPostProcessingQueue {
    constructor(
        @InjectRepository(EventProcessingJobEntity)
        private readonly jobs: Repository<EventProcessingJobEntity>,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    async enqueue(job: PostProcessingJobInput): Promise<void> {
        const now = this.clock.nowIso();
        await this.jobs.insert({
            jobId: this.idGen.newUuid(),
            eventId: job.eventId,
            jobType: job.jobType,
            status: "pending",
            attempts: 0,
            createdAt: now,
            updatedAt: now,
            lastError: null,
        });
    }
}
