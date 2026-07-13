import {LOCAL_JOB_LEASE_HEARTBEAT_MS} from "@monitor/kernel/job/job.const.js";
import {
    readJobAnchorEventId,
    toRuleGenerationRequest,
    type PendingRuleJob,
    type RuleJobRunner,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

const MAX_CONCURRENT_JOBS = 2;

function log(message: string): void {
    process.stderr.write(`[rule-gen] ${message}\n`);
}

/** 대기 중인 규칙 생성 잡을 클레임해 로컬 실행기에 넘기고 리스를 살려 둔다. */
export class PollRuleJobsUsecase {
    private readonly running = new Map<string, AbortController>();

    constructor(
        private readonly jobs: RuleJobPort,
        private readonly runner: RuleJobRunner,
        private readonly maxConcurrent: number = MAX_CONCURRENT_JOBS,
    ) {}

    hasRunning(): boolean {
        return this.running.size > 0;
    }

    /** 데몬이 내려갈 때 실행을 끊고 잡을 서버에 반납한다. */
    async releaseRunning(): Promise<void> {
        const jobIds = [...this.running.keys()];
        for (const [jobId, cancel] of this.running) {
            cancel.abort(new Error("daemon shutting down"));
            log(`releasing job ${jobId} on shutdown`);
        }
        this.running.clear();
        await Promise.all(
            jobIds.map((jobId) => this.jobs.release(jobId).catch(() => log(`failed to release job ${jobId}`))),
        );
    }

    async execute(): Promise<void> {
        let pending: readonly PendingRuleJob[];
        try {
            pending = await this.jobs.pendingJobs();
        } catch {
            return;
        }

        for (const job of pending) {
            if (this.running.size >= this.maxConcurrent) break;
            const taskId = job.taskId;
            if (taskId === null || taskId.length === 0 || this.running.has(job.id)) continue;
            await this.dispatch(job, taskId);
        }
    }

    private async dispatch(job: PendingRuleJob, taskId: string): Promise<void> {
        const workspacePath = await this.jobs.workspacePath(taskId);
        if (workspacePath === null) {
            log(`no workspacePath for task ${taskId}, failing job ${job.id}`);
            await this.jobs.fail(job.id, `task ${taskId} has no workspacePath`)
                .catch(() => log(`failed to mark job ${job.id} failed`));
            return;
        }

        try {
            if (!await this.jobs.claim(job.id)) {
                log(`could not start job ${job.id}, skipping`);
                return;
            }
        } catch (error) {
            log(`could not start job ${job.id}: ${String(error)}`);
            return;
        }

        const anchorEventId = readJobAnchorEventId(job);
        const anchorText = anchorEventId === undefined
            ? undefined
            : await this.jobs.anchorText(taskId, anchorEventId);
        const request = toRuleGenerationRequest(job, taskId, {
            workspacePath,
            ...(anchorText !== undefined ? {anchorText} : {}),
        });

        const cancel = new AbortController();
        this.running.set(job.id, cancel);
        const heartbeat = this.startHeartbeat(job.id, cancel);
        log(`starting job ${job.id} for task ${taskId}`);

        void this.runner(request, cancel.signal)
            .then(() => log(`job ${job.id} completed`))
            .catch((error: unknown) => {
                log(`job ${job.id} threw: ${String(error)}`);
                if (cancel.signal.aborted) return;
                void this.jobs.fail(job.id, String(error))
                    .catch(() => log(`failed to mark job ${job.id} failed after throw`));
            })
            .finally(() => {
                clearInterval(heartbeat);
                this.running.delete(job.id);
            });
    }

    private startHeartbeat(jobId: string, cancel: AbortController): NodeJS.Timeout {
        const heartbeat = setInterval(() => {
            void this.jobs.renewLease(jobId)
                .then((state) => {
                    if (!state.leaseHeld || state.canceled) cancel.abort(new Error("job canceled"));
                })
                .catch(() => undefined);
        }, LOCAL_JOB_LEASE_HEARTBEAT_MS);
        heartbeat.unref();
        return heartbeat;
    }
}
