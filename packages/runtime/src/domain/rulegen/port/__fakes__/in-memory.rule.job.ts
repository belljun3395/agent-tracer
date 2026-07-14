import type {
    PendingRuleJob,
    RuleGenerationFailure,
    RuleGenerationReport,
    RuleJobLeaseState,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

export interface RecordedEnqueue {
    readonly taskId: string;
    readonly anchorEventId: string;
    readonly maxRules: number;
}

export class InMemoryRuleJob implements RuleJobPort {
    readonly claimed: string[] = [];
    readonly released: string[] = [];
    readonly failed: {jobId: string; error: string}[] = [];
    readonly failures: {jobId: string; failure: RuleGenerationFailure}[] = [];
    readonly reported: {jobId: string; report: RuleGenerationReport}[] = [];
    readonly enqueued: RecordedEnqueue[] = [];
    readonly renewed: string[] = [];

    workspaces = new Map<string, string>();
    anchors = new Map<string, string>();
    lease: RuleJobLeaseState = {leaseHeld: true, canceled: false};
    claimable = true;
    reportOk = true;
    activeJob = false;
    enqueueOk = true;

    constructor(private readonly jobs: readonly PendingRuleJob[] = []) {}

    async pendingJobs(): Promise<readonly PendingRuleJob[]> {
        return this.jobs;
    }

    async workspacePath(taskId: string): Promise<string | null> {
        return this.workspaces.get(taskId) ?? null;
    }

    async anchorText(_taskId: string, anchorEventId: string): Promise<string | undefined> {
        return this.anchors.get(anchorEventId);
    }

    async claim(jobId: string): Promise<boolean> {
        if (!this.claimable) return false;
        this.claimed.push(jobId);
        return true;
    }

    async renewLease(jobId: string): Promise<RuleJobLeaseState> {
        this.renewed.push(jobId);
        return this.lease;
    }

    async reportResult(jobId: string, report: RuleGenerationReport): Promise<boolean> {
        this.reported.push({jobId, report});
        return this.reportOk;
    }

    async fail(jobId: string, failure: RuleGenerationFailure): Promise<void> {
        this.failed.push({jobId, error: failure.error});
        this.failures.push({jobId, failure});
    }

    async release(jobId: string): Promise<void> {
        this.released.push(jobId);
    }

    async hasActiveJob(_taskId: string): Promise<boolean> {
        return this.activeJob;
    }

    async enqueue(taskId: string, anchorEventId: string, maxRules: number): Promise<boolean> {
        this.enqueued.push({taskId, anchorEventId, maxRules});
        return this.enqueueOk;
    }
}
