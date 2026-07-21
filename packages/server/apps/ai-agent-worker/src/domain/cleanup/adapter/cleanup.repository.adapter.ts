import { JOB_STATUS, SERVER_SDK_TASK_ORIGIN, type JobStatus } from "@monitor/kernel";
import {
    AiJobStepEntity,
    isJobTransitionLost,
    JobTransitionLostError,
    type AiJobRepository,
    type AiJobStepRepository,
    type AppSettingRepository,
    type TaskEntity,
    type TaskRepository,
    type TaskUserStateRepository,
    type TransactionRunner,
} from "@monitor/tracer-domain";
import { type GeneratedAiJobStep } from "@monitor/llm-runtime";
import { foldAttempt, type JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { CleanupTaskSnapshot } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type {
    CleanupCommit,
    CleanupFailedAttempt,
    CleanupJobSnapshot,
    CleanupRepositoryPort,
    CleanupScanBatch,
} from "~ai-agent-worker/domain/cleanup/port/cleanup.repository.port.js";
import { persistCleanupSuggestions } from "./cleanup.suggestion.persistence.js";

const NON_TERMINAL: readonly JobStatus[] = [JOB_STATUS.pending, JOB_STATUS.running];
const TASK_SCAN_LIMIT = 500;

/** cleanup 슬라이스의 저장 포트를 읽기 모델 저장소로 구현한다. */
export class CleanupRepositoryAdapter implements CleanupRepositoryPort {
    constructor(
        private readonly jobs: AiJobRepository,
        private readonly tasks: TaskRepository,
        private readonly taskStates: TaskUserStateRepository,
        private readonly settings: AppSettingRepository,
        private readonly tx: TransactionRunner,
    ) {}

    async findJob(jobId: string): Promise<CleanupJobSnapshot | null> {
        const job = await this.jobs.findById(jobId);
        return job === null ? null : { id: job.id, userId: job.userId, usage: job.usage };
    }

    async startJob(jobId: string, now: Date): Promise<boolean> {
        const job = await this.jobs.findById(jobId);
        if (job === null) return false;
        job.start(now);
        return this.jobs.commitTransition(job, NON_TERMINAL);
    }

    async readSetting(scope: string, key: string): Promise<string | null> {
        const setting = await this.settings.findByScopeAndKey(scope, key);
        return setting !== null && setting.value.length > 0 ? setting.value : null;
    }

    async loadScanBatch(userId: string): Promise<CleanupScanBatch> {
        const page = await this.tasks.findPage(userId, { archived: false, limit: TASK_SCAN_LIMIT + 1 });
        const truncated = page.length > TASK_SCAN_LIMIT;
        const limited = truncated ? page.slice(0, TASK_SCAN_LIMIT) : page;
        // 서버 에이전트가 만든 태스크는 사용자 정리 대상이 아니다.
        const userTasks = limited.filter((task) => task.origin !== SERVER_SDK_TASK_ORIGIN);
        const hidden = await this.hiddenTaskIds(userTasks.map((task) => task.id));
        const visible = userTasks.filter((task) => !hidden.has(task.id));

        const activeChildren = await this.tasks.findActiveChildren(visible.map((task) => task.id));
        return {
            tasks: visible.map(toTaskSnapshot),
            activeChildParentIds: activeChildren
                .map((child) => child.parentTaskId)
                .filter((parentId): parentId is string => parentId !== null),
            truncated,
            tasksScanned: userTasks.length,
        };
    }

    async recordFailedAttempt(input: CleanupFailedAttempt): Promise<void> {
        try {
            await this.tx.run(async (tx) => {
                const job = await tx.jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);
                const { attempts } = foldAttempt(job.usage, input.record);
                job.recordAttemptUsage({ attempts }, input.now);
                if (!(await tx.jobs.commitTransition(job, NON_TERMINAL))) {
                    throw new JobTransitionLostError(input.jobId);
                }
                await insertSteps(tx.jobSteps, input.jobId, input.userId, input.steps, input.record.attempt);
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return;
            throw error;
        }
    }

    async foldSuccessAttempt(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{ readonly attempts: readonly JobAttemptRecord[] | undefined; readonly costUsd: number | null }> {
        const job = await this.jobs.findById(jobId);
        const { attempts, totalCostUsd } = foldAttempt(job?.usage ?? {}, record);
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        return { attempts, costUsd: totalCostUsd ?? record.costUsd };
    }

    async commitCleanup(input: CleanupCommit): Promise<{ readonly suggestionsCreated: number } | null> {
        try {
            return await this.tx.run(async (tx) => {
                const job = await tx.jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);

                const suggestionsCreated = await persistCleanupSuggestions(
                    tx,
                    input.userId,
                    job.id,
                    input.suggestions,
                    input.now,
                );
                await insertSteps(tx.jobSteps, job.id, input.userId, input.steps, input.attempt);
                job.complete(
                    { suggestionsCreated, tasksScanned: input.tasksScanned },
                    input.usage,
                    input.now,
                );
                if (!(await tx.jobs.commitTransition(job, NON_TERMINAL))) {
                    throw new JobTransitionLostError(job.id);
                }
                return { suggestionsCreated };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }

    async failJob(jobId: string, message: string, now: Date): Promise<CleanupJobSnapshot | null> {
        const job = await this.jobs.findById(jobId);
        if (job === null || job.isTerminal()) return null;
        job.fail(message, now);
        if (!(await this.jobs.commitTransition(job, NON_TERMINAL))) return null;
        return { id: job.id, userId: job.userId, usage: job.usage };
    }

    private async hiddenTaskIds(taskIds: readonly string[]): Promise<ReadonlySet<string>> {
        const states = await this.taskStates.findByIds(taskIds);
        return new Set(states.filter((state) => state.isHidden()).map((state) => state.taskId));
    }
}

function toTaskSnapshot(task: TaskEntity): CleanupTaskSnapshot {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        lastEventAt: task.lastEventAt !== null ? task.lastEventAt.toISOString() : null,
        updatedAt: task.updatedAt.toISOString(),
    };
}

async function insertSteps(
    repo: AiJobStepRepository,
    jobId: string,
    userId: string,
    steps: readonly GeneratedAiJobStep[],
    attempt: number,
): Promise<void> {
    if (steps.length === 0) return;
    await repo.insertMany(
        steps.map((step) =>
            AiJobStepEntity.create({ id: step.id, jobId, userId, attempt, step, now: new Date() }),
        ),
    );
}
