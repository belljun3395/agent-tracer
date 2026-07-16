import { JOB_STATUS, type JobStatus } from "@monitor/kernel";
import {
    AiJobStepEntity,
    isJobTransitionLost,
    JobTransitionLostError,
    TaskView,
    type AiJobRepository,
    type AiJobStepRepository,
    type AppSettingRepository,
    type TaskRepository,
    type TaskUserStateRepository,
    type TransactionRunner,
} from "@monitor/tracer-domain";
import { foldAttempt, type JobAttemptRecord } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { GeneratedAiJobStep } from "~ai-agent-worker/support/llm/job.step.js";
import type {
    RecipeAnchorSnapshot,
    RecipeFailedAttempt,
    RecipeJobSnapshot,
    RecipeRepositoryPort,
    RecipeScanCommit,
} from "~ai-agent-worker/domain/recipe/port/recipe.repository.port.js";
import { persistRecipeCandidates } from "./recipe.candidate.persistence.js";

const NON_TERMINAL: readonly JobStatus[] = [JOB_STATUS.pending, JOB_STATUS.running];

/** recipe 슬라이스의 저장 포트를 읽기 모델 저장소로 구현한다. */
export class RecipeRepositoryAdapter implements RecipeRepositoryPort {
    constructor(
        private readonly jobs: AiJobRepository,
        private readonly tasks: TaskRepository,
        private readonly taskStates: TaskUserStateRepository,
        private readonly settings: AppSettingRepository,
        private readonly tx: TransactionRunner,
    ) {}

    async findJob(jobId: string): Promise<RecipeJobSnapshot | null> {
        const job = await this.jobs.findById(jobId);
        return job === null ? null : { id: job.id, userId: job.userId, taskId: job.taskId, usage: job.usage };
    }

    async startJob(jobId: string, now: Date): Promise<boolean> {
        const job = await this.jobs.findById(jobId);
        if (job === null) return false;
        job.start(now);
        return this.jobs.commitTransition(job, NON_TERMINAL);
    }

    async findAnchor(userId: string, taskId: string): Promise<RecipeAnchorSnapshot | null> {
        const task = await this.tasks.findById(taskId);
        if (task === null) return null;
        if (!task.isOwnedBy(userId)) {
            return { ownedByUser: false, scanEligible: false, sessionScanEligible: false };
        }
        const view = new TaskView(task, await this.taskStates.findById(taskId));
        return {
            ownedByUser: true,
            scanEligible: view.isRecipeScanEligible(),
            sessionScanEligible: view.isSessionRecipeScanEligible(),
        };
    }

    async readSetting(scope: string, key: string): Promise<string | null> {
        const setting = await this.settings.findByScopeAndKey(scope, key);
        return setting !== null && setting.value.length > 0 ? setting.value : null;
    }

    async findOwnedTaskIds(userId: string, taskIds: readonly string[]): Promise<readonly string[]> {
        if (taskIds.length === 0) return [];
        const tasks = await this.tasks.findByIds(taskIds);
        return tasks.filter((task) => task.userId === userId).map((task) => task.id);
    }

    async recordFailedAttempt(input: RecipeFailedAttempt): Promise<void> {
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

    async commitScan(input: RecipeScanCommit): Promise<{ readonly candidatesCreated: number } | null> {
        try {
            return await this.tx.run(async (tx) => {
                const job = await tx.jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);

                const candidatesCreated = await persistRecipeCandidates(
                    tx,
                    { userId: input.userId, language: input.language, sourceJobId: job.id },
                    input.recipes,
                    input.now,
                );
                await insertSteps(tx.jobSteps, job.id, input.userId, input.steps, input.attempt);
                job.complete(
                    { candidatesCreated, sourceTaskId: input.sourceTaskId },
                    input.usage,
                    input.now,
                );
                if (!(await tx.jobs.commitTransition(job, NON_TERMINAL))) {
                    throw new JobTransitionLostError(job.id);
                }
                return { candidatesCreated };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }

    async failJob(jobId: string, message: string, now: Date): Promise<RecipeJobSnapshot | null> {
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
