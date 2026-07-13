import {JOB_KIND, JOB_STATUS, RULE_GENERATION_FOCUS} from "@monitor/kernel/job/job.const.js";
import {MONITOR_LEASE_OWNER_HEADER} from "@monitor/kernel/user/user.header.const.js";
import {getJson, postJson} from "~runtime/config/http.js";
import type {
    PendingRuleJob,
    RuleGenerationReport,
    RuleJobLeaseState,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([JOB_STATUS.pending, JOB_STATUS.running]);
const HELD_LEASE: RuleJobLeaseState = {leaseHeld: true, canceled: false};
const REPORT_MAX_ATTEMPTS = 3;
const REPORT_BACKOFF_MS = 500;

interface JobListEnvelope {
    readonly data?: {readonly items?: readonly PendingRuleJob[]};
}

interface LatestJobEnvelope {
    readonly data?: {readonly job: {readonly status: string} | null};
}

interface TaskEnvelope {
    readonly data?: {readonly task: {readonly workspacePath?: string} | null};
}

interface UserInputEnvelope {
    readonly data?: {readonly items?: readonly {readonly eventId: string; readonly text: string}[]};
}

interface LeaseEnvelope {
    readonly data?: RuleJobLeaseState;
}

/** 규칙 생성 잡의 수명주기를 서버 잡 API로 왕복한다. */
export class HttpRuleJobAdapter implements RuleJobPort {
    private readonly leaseHeaders: Record<string, string>;

    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
        leaseOwner: string,
    ) {
        this.leaseHeaders = {...headers, [MONITOR_LEASE_OWNER_HEADER]: leaseOwner};
    }

    async pendingJobs(): Promise<readonly PendingRuleJob[]> {
        const url = `${this.baseUrl}/api/v1/jobs?kind=${encodeURIComponent(JOB_KIND.ruleGeneration)}&status=${encodeURIComponent(JOB_STATUS.pending)}`;
        const body = await getJson<JobListEnvelope>(url, this.headers);
        return body?.data?.items ?? [];
    }

    async workspacePath(taskId: string): Promise<string | null> {
        const url = `${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`;
        const body = await getJson<TaskEnvelope>(url, this.headers);
        return body?.data?.task?.workspacePath ?? null;
    }

    async anchorText(taskId: string, anchorEventId: string): Promise<string | undefined> {
        try {
            const url = `${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/user-inputs`;
            const body = await getJson<UserInputEnvelope>(url, this.headers);
            return body?.data?.items?.find((item) => item.eventId === anchorEventId)?.text;
        } catch {
            return undefined;
        }
    }

    async claim(jobId: string): Promise<boolean> {
        const response = await postJson(this.jobUrl(jobId, "start"), this.leaseHeaders, {});
        return response.ok;
    }

    async renewLease(jobId: string): Promise<RuleJobLeaseState> {
        const response = await postJson(this.jobUrl(jobId, "lease"), this.leaseHeaders, {});
        if (!response.ok) return HELD_LEASE;
        const body = await response.json() as LeaseEnvelope;
        return body.data ?? HELD_LEASE;
    }

    async reportResult(jobId: string, report: RuleGenerationReport): Promise<boolean> {
        for (let attempt = 1; attempt <= REPORT_MAX_ATTEMPTS; attempt += 1) {
            try {
                const response = await postJson(this.jobUrl(jobId, "results"), this.leaseHeaders, report);
                if (response.ok) return true;
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                if (attempt === REPORT_MAX_ATTEMPTS) {
                    process.stderr.write(`[rule-gen] result report failed for job ${jobId}: ${String(error)}\n`);
                    return false;
                }
                await sleep(REPORT_BACKOFF_MS * attempt);
            }
        }
        return false;
    }

    async fail(jobId: string, error: string): Promise<void> {
        await postJson(this.jobUrl(jobId, "fail"), this.leaseHeaders, {error});
    }

    async release(jobId: string): Promise<void> {
        await postJson(this.jobUrl(jobId, "release"), this.leaseHeaders, {});
    }

    async hasActiveJob(taskId: string): Promise<boolean> {
        const url = `${this.baseUrl}/api/v1/jobs/latest?kind=${encodeURIComponent(JOB_KIND.ruleGeneration)}&taskId=${encodeURIComponent(taskId)}`;
        const body = await getJson<LatestJobEnvelope>(url, this.headers);
        const status = body?.data?.job?.status;
        return status !== undefined && ACTIVE_STATUSES.has(status);
    }

    async enqueue(taskId: string, anchorEventId: string, maxRules: number): Promise<boolean> {
        const response = await postJson(`${this.baseUrl}/api/v1/jobs`, this.headers, {
            kind: JOB_KIND.ruleGeneration,
            input: {
                taskId,
                anchorEventId,
                focus: RULE_GENERATION_FOCUS.recent,
                maxRules,
            },
            idempotencyKey: anchorEventId,
        });
        return response.ok;
    }

    private jobUrl(jobId: string, action: string): string {
        return `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/${action}`;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
