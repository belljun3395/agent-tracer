import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { BaseJobWorker } from "~main/scheduling/base-job-worker.js";
import { GovernanceJobEntity } from "~governance/job/governance.job.entity.js";
import { GovernanceJobRepository } from "~governance/job/governance.job.repository.js";
import { TaskRuleGenerationService } from "./task.rule.generation.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
// Slightly larger batch than the scan workers — rule generation is per-task
// and infrequent, so a couple can run back-to-back.
const BATCH_SIZE = 2;

/** Polls governance_jobs (jobType=rule_generation) for pending rows and dispatches them. */
@Injectable()
export class TaskRuleGenerationWorker extends BaseJobWorker<GovernanceJobEntity> {
    protected readonly logger = new Logger(TaskRuleGenerationWorker.name);

    constructor(
        private readonly jobs: GovernanceJobRepository,
        private readonly service: TaskRuleGenerationService,
    ) {
        super(BATCH_SIZE, MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS, IDLE_TICKS_BEFORE_BACKOFF);
    }

    @Interval("task-rule-generation-worker", MIN_POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        await this.runTick();
    }

    protected findPending(limit: number): Promise<readonly GovernanceJobEntity[]> {
        return this.jobs.findPending("rule_generation", limit);
    }

    protected claim(jobId: string, startedAt: string): Promise<GovernanceJobEntity | null> {
        return this.jobs.claim(jobId, startedAt);
    }

    protected process(job: GovernanceJobEntity): Promise<void> {
        return this.service.execute(job);
    }

    protected describe(job: GovernanceJobEntity): string {
        return `rule generation: jobId=${job.id} taskId=${job.taskId}`;
    }
}
