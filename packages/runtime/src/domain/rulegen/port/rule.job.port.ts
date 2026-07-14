import type {
    PendingRuleJob,
    RuleGenerationFailure,
    RuleGenerationReport,
    RuleJobLeaseState,
} from "~runtime/domain/rulegen/model/rule.job.model.js";

/** 규칙 생성 잡의 조회와 클레임과 결과 보고를 서버 잡 API에 맡긴다. */
export interface RuleJobPort {
    pendingJobs(): Promise<readonly PendingRuleJob[]>;
    workspacePath(taskId: string): Promise<string | null>;
    anchorText(taskId: string, anchorEventId: string): Promise<string | undefined>;
    claim(jobId: string): Promise<boolean>;
    renewLease(jobId: string): Promise<RuleJobLeaseState>;
    reportResult(jobId: string, report: RuleGenerationReport): Promise<boolean>;
    fail(jobId: string, failure: RuleGenerationFailure): Promise<void>;
    release(jobId: string): Promise<void>;
    hasActiveJob(taskId: string): Promise<boolean>;
    enqueue(taskId: string, anchorEventId: string, maxRules: number): Promise<boolean>;
}
