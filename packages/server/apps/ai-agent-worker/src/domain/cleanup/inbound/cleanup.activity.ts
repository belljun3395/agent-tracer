import { ApplicationFailure, Context } from "@temporalio/activity";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import { isNonRetryableCleanupError } from "~ai-agent-worker/domain/cleanup/model/cleanup.error.js";
import type {
    FailCleanupJobInput,
    TaskCleanupFinalizeInput,
    TaskCleanupGenerateOutput,
    TaskCleanupInput,
    TaskCleanupPrep,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";
import type { PrepareTaskCleanupUsecase } from "~ai-agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";
import type { SuggestCleanupUsecase } from "~ai-agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import type { FinalizeTaskCleanupUsecase } from "~ai-agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import type { FailCleanupJobUsecase } from "~ai-agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 태스크 정리 유스케이스에 잇는다. */
export class CleanupActivity {
    constructor(
        private readonly prepare: PrepareTaskCleanupUsecase,
        private readonly suggest: SuggestCleanupUsecase,
        private readonly finalize: FinalizeTaskCleanupUsecase,
        private readonly fail: FailCleanupJobUsecase,
    ) {}

    prepareTaskCleanup = async (input: TaskCleanupInput): Promise<TaskCleanupPrep> =>
        this.guard(() => this.prepare.execute(input));

    generateTaskCleanupSuggestions = async (prep: TaskCleanupPrep): Promise<TaskCleanupGenerateOutput> => {
        const ctx = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.guard(() =>
                this.suggest.execute(prep, {
                    attempt: ctx.info.attempt,
                    idempotencyKey: `${ctx.info.workflowExecution?.workflowId ?? prep.jobId}-${ctx.info.activityId}`,
                    abortSignal: ctx.cancellationSignal,
                }),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeTaskCleanup = async (input: TaskCleanupFinalizeInput): Promise<void> =>
        this.guard(() => this.finalize.execute(input));

    markCleanupJobFailed = async (input: FailCleanupJobInput): Promise<void> =>
        this.guard(() => this.fail.execute(input));

    private async guard<T>(run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (err) {
            if (!(err instanceof Error)) throw err;
            if (isNonRetryableCleanupError(err)) {
                throw ApplicationFailure.nonRetryable(err.message, err.name, err);
            }
            if (err instanceof AgentExecutionFailure && err.retryAfterMs !== null) {
                throw ApplicationFailure.create({
                    message: err.message,
                    type: err.name,
                    nonRetryable: false,
                    cause: err,
                    nextRetryDelay: err.retryAfterMs,
                });
            }
            throw err;
        }
    }
}
