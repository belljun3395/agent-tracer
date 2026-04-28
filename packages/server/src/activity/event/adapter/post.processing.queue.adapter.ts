import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventProcessingJobEntity } from "~activity/event/domain/event-store/event.processing.job.entity.js";
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
    ) {}

    async enqueue(job: PostProcessingJobInput): Promise<void> {
        const now = new Date().toISOString();
        await this.jobs.insert({
            jobId: randomUUID(),
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
