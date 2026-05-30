import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { BaseJobWorker } from "~main/scheduling/base-job-worker.js";
import { GovernanceJobEntity } from "~governance/job/governance.job.entity.js";
import { GovernanceJobRepository } from "~governance/job/governance.job.repository.js";
import { RecipeScanService } from "./recipe.scan.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
// Batch=1 — each scan touches every selected task, so running two in parallel
// just wastes API calls.
const BATCH_SIZE = 1;

/** Polls governance_jobs (jobType=recipe_scan) for pending rows and dispatches them. */
@Injectable()
export class RecipeScanWorker extends BaseJobWorker<GovernanceJobEntity> {
    protected readonly logger = new Logger(RecipeScanWorker.name);

    constructor(
        private readonly jobs: GovernanceJobRepository,
        private readonly service: RecipeScanService,
    ) {
        super(BATCH_SIZE, MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS, IDLE_TICKS_BEFORE_BACKOFF);
    }

    @Interval("recipe-scan-worker", MIN_POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        await this.runTick();
    }

    protected findPending(limit: number): Promise<readonly GovernanceJobEntity[]> {
        return this.jobs.findPending("recipe_scan", limit);
    }

    protected claim(jobId: string, startedAt: string): Promise<GovernanceJobEntity | null> {
        return this.jobs.claim(jobId, startedAt);
    }

    protected process(job: GovernanceJobEntity): Promise<void> {
        return this.service.execute(job);
    }

    protected describe(job: GovernanceJobEntity): string {
        return `recipe scan: jobId=${job.id}`;
    }
}
