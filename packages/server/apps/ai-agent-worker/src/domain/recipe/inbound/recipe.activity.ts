import { ApplicationFailure, Context } from "@temporalio/activity";
import { errorMessage, logError, logInfo, logWarn } from "~ai-agent-worker/support/log.js";
import { AgentExecutionFailure } from "@monitor/llm-runtime";
import { isNonRetryableRecipeError } from "~ai-agent-worker/domain/recipe/model/recipe.error.js";
import type {
    FailRecipeJobInput,
    RecipeScanFinalizeInput,
    RecipeScanGenerateOutput,
    RecipeScanInput,
    RecipeScanPrep,
} from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";
import type { PrepareRecipeScanUsecase } from "~ai-agent-worker/domain/recipe/application/prepare.recipe.scan.usecase.js";
import type { ScanRecipeUsecase } from "~ai-agent-worker/domain/recipe/application/scan.recipe.usecase.js";
import type { FinalizeRecipeScanUsecase } from "~ai-agent-worker/domain/recipe/application/finalize.recipe.scan.usecase.js";
import type { FailRecipeJobUsecase } from "~ai-agent-worker/domain/recipe/application/fail.recipe.job.usecase.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 레시피 유스케이스에 잇는다. */
export class RecipeActivity {
    constructor(
        private readonly prepare: PrepareRecipeScanUsecase,
        private readonly scan: ScanRecipeUsecase,
        private readonly finalize: FinalizeRecipeScanUsecase,
        private readonly fail: FailRecipeJobUsecase,
    ) {}

    prepareRecipeScan = async (input: RecipeScanInput): Promise<RecipeScanPrep> =>
        this.guard("prepareRecipeScan", input.jobId, () => this.prepare.execute(input));

    generateRecipeCandidates = async (prep: RecipeScanPrep): Promise<RecipeScanGenerateOutput> => {
        const ctx = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.guard("generateRecipeCandidates", prep.jobId, () =>
                this.scan.execute(prep, {
                    attempt: ctx.info.attempt,
                    idempotencyKey: `${ctx.info.workflowExecution?.workflowId ?? prep.jobId}-${ctx.info.activityId}`,
                    abortSignal: ctx.cancellationSignal,
                }),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeRecipeScan = async (input: RecipeScanFinalizeInput): Promise<void> =>
        this.guard("finalizeRecipeScan", input.jobId, () => this.finalize.execute(input));

    markRecipeJobFailed = async (input: FailRecipeJobInput): Promise<void> =>
        this.guard("markRecipeJobFailed", input.jobId, () => this.fail.execute(input));

    private async guard<T>(activity: string, jobId: string, run: () => Promise<T>): Promise<T> {
        const attempt = Context.current().info.attempt;
        const startedAt = Date.now();
        try {
            const result = await run();
            logInfo({ msg: "activity.completed", activity, jobId, attempt, durationMs: Date.now() - startedAt });
            return result;
        } catch (err) {
            const durationMs = Date.now() - startedAt;
            if (!(err instanceof Error)) throw err;
            if (isNonRetryableRecipeError(err)) {
                logError({ msg: "activity.abandoned", activity, jobId, attempt, durationMs, error: errorMessage(err) });
                throw ApplicationFailure.nonRetryable(err.message, err.name, err);
            }
            if (err instanceof AgentExecutionFailure && err.retryAfterMs !== null) {
                logWarn({
                    msg: "activity.rate_limited",
                    activity,
                    jobId,
                    attempt,
                    durationMs,
                    nextRetryDelay: err.retryAfterMs,
                    error: errorMessage(err),
                });
                throw ApplicationFailure.create({
                    message: err.message,
                    type: err.name,
                    nonRetryable: false,
                    cause: err,
                    nextRetryDelay: err.retryAfterMs,
                });
            }
            logError({ msg: "activity.failed", activity, jobId, attempt, durationMs, error: errorMessage(err) });
            throw err;
        }
    }
}
