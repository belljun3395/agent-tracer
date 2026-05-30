import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { BaseJobWorker } from "~main/scheduling/base-job-worker.js";
import { TaskRuleGenerationJobEntity } from "../domain/task.rule.generation.job.entity.js";
import { TaskRuleGenerationJobRepository } from "../repository/task.rule.generation.job.repository.js";
import { TaskRuleGenerationService } from "./task.rule.generation.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
// Slightly larger batch than the scan workers — rule generation is per-task
// and infrequent, so a couple can run back-to-back.
const BATCH_SIZE = 2;

/** Polls `task_rule_generation_jobs` for pending rows and dispatches them. */
@Injectable()
export class TaskRuleGenerationWorker extends BaseJobWorker<TaskRuleGenerationJobEntity> {
    protected readonly logger = new Logger(TaskRuleGenerationWorker.name);

    constructor(
        private readonly jobs: TaskRuleGenerationJobRepository,
        private readonly service: TaskRuleGenerationService,
    ) {
        super(BATCH_SIZE, MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS, IDLE_TICKS_BEFORE_BACKOFF);
    }

    @Interval("task-rule-generation-worker", MIN_POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        await this.runTick();
    }

    protected findPending(limit: number): Promise<readonly TaskRuleGenerationJobEntity[]> {
        return this.jobs.findPending(limit);
    }

    protected claim(jobId: string, startedAt: string): Promise<TaskRuleGenerationJobEntity | null> {
        return this.jobs.claim(jobId, startedAt);
    }

    protected process(job: TaskRuleGenerationJobEntity): Promise<void> {
        return this.service.execute(job);
    }

    protected describe(job: TaskRuleGenerationJobEntity): string {
        return `rule generation: jobId=${job.id} taskId=${job.taskId}`;
    }
}
