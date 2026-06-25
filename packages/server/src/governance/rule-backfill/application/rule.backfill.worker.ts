import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { BaseJobWorker } from "~main/scheduling/base-job-worker.js";
import { GovernanceJobEntity } from "~governance/job/governance.job.entity.js";
import { GovernanceJobRepository } from "~governance/job/governance.job.repository.js";
import { RuleBackfillService } from "./rule.backfill.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
// Backfill is a local DB sweep (no LLM); a couple can run back-to-back.
const BATCH_SIZE = 2;

/** Polls governance_jobs (jobType=rule_backfill) for pending rows and dispatches them. */
@Injectable()
export class RuleBackfillWorker extends BaseJobWorker<GovernanceJobEntity> {
    protected readonly logger = new Logger(RuleBackfillWorker.name);

    constructor(
        private readonly jobs: GovernanceJobRepository,
        private readonly service: RuleBackfillService,
    ) {
        super(BATCH_SIZE, MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS, IDLE_TICKS_BEFORE_BACKOFF);
    }

    @Interval("rule-backfill-worker", MIN_POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        await this.runTick();
    }

    protected findPending(limit: number): Promise<readonly GovernanceJobEntity[]> {
        return this.jobs.findPending("rule_backfill", limit);
    }

    protected claim(jobId: string, startedAt: string): Promise<GovernanceJobEntity | null> {
        return this.jobs.claim(jobId, startedAt);
    }

    protected process(job: GovernanceJobEntity): Promise<void> {
        return this.service.execute(job);
    }

    protected describe(job: GovernanceJobEntity): string {
        return `rule backfill: jobId=${job.id} ruleId=${job.ruleId}`;
    }
}
