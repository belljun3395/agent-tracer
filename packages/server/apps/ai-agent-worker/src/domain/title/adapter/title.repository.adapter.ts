import { JOB_STATUS, type JobStatus } from "@monitor/kernel";
import {
    AiJobStepEntity,
    isJobTransitionLost,
    JobTransitionLostError,
    type AiJobRepository,
    type AiJobStepRepository,
    type AppSettingRepository,
    type EventRepository,
    type TaskRepository,
    type TransactionRunner,
    type TurnRepository,
} from "@monitor/tracer-domain";
import { foldAttempt, type JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { GeneratedAiJobStep } from "~ai-agent-worker/support/llm/job.step.js";
import { buildTitleContext } from "~ai-agent-worker/domain/title/model/title.context.model.js";
import type {
    TitleFailedAttempt,
    TitleJobSnapshot,
    TitleRepositoryPort,
    TitleSuggestionCommit,
    TitleTaskContext,
} from "~ai-agent-worker/domain/title/port/title.repository.port.js";

const NON_TERMINAL: readonly JobStatus[] = [JOB_STATUS.pending, JOB_STATUS.running];

/** title 슬라이스의 저장 포트를 읽기 모델 저장소로 구현한다. */
export class TitleRepositoryAdapter implements TitleRepositoryPort {
    constructor(
        private readonly jobs: AiJobRepository,
        private readonly tasks: TaskRepository,
        private readonly events: EventRepository,
        private readonly turns: TurnRepository,
        private readonly settings: AppSettingRepository,
        private readonly tx: TransactionRunner,
    ) {}

    async findJob(jobId: string): Promise<TitleJobSnapshot | null> {
        const job = await this.jobs.findById(jobId);
        return job === null ? null : { id: job.id, userId: job.userId, taskId: job.taskId, usage: job.usage };
    }

    async startJob(jobId: string, now: Date): Promise<boolean> {
        const job = await this.jobs.findById(jobId);
        if (job === null) return false;
        job.start(now);
        return this.jobs.commitTransition(job, NON_TERMINAL);
    }

    async findTaskContext(userId: string, taskId: string): Promise<TitleTaskContext | null> {
        const task = await this.tasks.findById(taskId);
        if (task === null) return null;
        if (!task.isOwnedBy(userId)) return { ownedByUser: false, totalEventCount: 0, context: null };

        const [totalEventCount, turns] = await Promise.all([
            this.events.countByTask(taskId),
            this.turns.findByTask(taskId),
        ]);
        const context = buildTitleContext(
            {
                title: task.title,
                status: task.status,
                ...(task.workspacePath !== null ? { workspacePath: task.workspacePath } : {}),
            },
            turns.map((turn) => ({
                turnIndex: turn.turnIndex,
                askedText: turn.askedText ?? "",
                assistantText: turn.assistantText,
            })),
            totalEventCount,
        );
        return { ownedByUser: true, totalEventCount, context };
    }

    async readSetting(scope: string, key: string): Promise<string | null> {
        const setting = await this.settings.findByScopeAndKey(scope, key);
        return setting !== null && setting.value.length > 0 ? setting.value : null;
    }

    async recordFailedAttempt(input: TitleFailedAttempt): Promise<void> {
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

    async commitSuggestions(input: TitleSuggestionCommit): Promise<{ readonly suggestionsCreated: number } | null> {
        try {
            return await this.tx.run(async (tx) => {
                const job = await tx.jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);

                await insertSteps(tx.jobSteps, job.id, input.userId, input.steps, input.attempt);
                // 태스크를 직접 개명하지 않고 후보만 남겨 사용자가 고르게 한다.
                job.complete({ suggestions: input.suggestions }, input.usage, input.now);
                if (!(await tx.jobs.commitTransition(job, NON_TERMINAL))) {
                    throw new JobTransitionLostError(job.id);
                }
                return { suggestionsCreated: input.suggestions.length };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }

    async failJob(jobId: string, message: string, now: Date): Promise<TitleJobSnapshot | null> {
        const job = await this.jobs.findById(jobId);
        if (job === null || job.isTerminal()) return null;
        job.fail(message, now);
        if (!(await this.jobs.commitTransition(job, NON_TERMINAL))) return null;
        return { id: job.id, userId: job.userId, taskId: job.taskId, usage: job.usage };
    }
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
