import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { BaseJobWorker } from "~main/scheduling/base-job-worker.js";
import { TaskCleanupJobEntity } from "../domain/task.cleanup.job.entity.js";
import { TaskCleanupJobRepository } from "../repository/task.cleanup.job.repository.js";
import { TaskCleanupService } from "./task.cleanup.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
// Batch=1 — each scan touches every task, so running two in parallel would
// just waste API calls.
const BATCH_SIZE = 1;

/** Polls `task_cleanup_jobs` for pending rows and dispatches them. */
@Injectable()
export class TaskCleanupWorker extends BaseJobWorker<TaskCleanupJobEntity> {
    protected readonly logger = new Logger(TaskCleanupWorker.name);

    constructor(
        private readonly jobs: TaskCleanupJobRepository,
        private readonly service: TaskCleanupService,
    ) {
        super(BATCH_SIZE, MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS, IDLE_TICKS_BEFORE_BACKOFF);
    }

    @Interval("task-cleanup-worker", MIN_POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        await this.runTick();
    }

    protected findPending(limit: number): Promise<readonly TaskCleanupJobEntity[]> {
        return this.jobs.findPending(limit);
    }

    protected claim(jobId: string, startedAt: string): Promise<TaskCleanupJobEntity | null> {
        return this.jobs.claim(jobId, startedAt);
    }

    protected process(job: TaskCleanupJobEntity): Promise<void> {
        return this.service.execute(job);
    }

    protected describe(job: TaskCleanupJobEntity): string {
        return `task cleanup scan: jobId=${job.id}`;
    }
}
