import { ApplicationFailure, Context } from "@temporalio/activity";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import { isNonRetryableTitleError } from "~ai-agent-worker/domain/title/model/title.error.js";
import type {
    FailTitleJobInput,
    TitleSuggestionFinalizeInput,
    TitleSuggestionGenerateOutput,
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~ai-agent-worker/domain/title/model/title.job.model.js";
import type { PrepareTitleSuggestionUsecase } from "~ai-agent-worker/domain/title/application/prepare.title.suggestion.usecase.js";
import type { SuggestTitleUsecase } from "~ai-agent-worker/domain/title/application/suggest.title.usecase.js";
import type { FinalizeTitleSuggestionUsecase } from "~ai-agent-worker/domain/title/application/finalize.title.suggestion.usecase.js";
import type { FailTitleJobUsecase } from "~ai-agent-worker/domain/title/application/fail.title.job.usecase.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 제목 제안 유스케이스에 잇는다. */
export class TitleActivity {
    constructor(
        private readonly prepare: PrepareTitleSuggestionUsecase,
        private readonly suggest: SuggestTitleUsecase,
        private readonly finalize: FinalizeTitleSuggestionUsecase,
        private readonly fail: FailTitleJobUsecase,
    ) {}

    prepareTitleSuggestion = async (input: TitleSuggestionInput): Promise<TitleSuggestionPrep> =>
        this.guard(() => this.prepare.execute(input));

    generateTitleSuggestion = async (prep: TitleSuggestionPrep): Promise<TitleSuggestionGenerateOutput> => {
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

    finalizeTitleSuggestion = async (input: TitleSuggestionFinalizeInput): Promise<void> =>
        this.guard(() => this.finalize.execute(input));

    markTitleJobFailed = async (input: FailTitleJobInput): Promise<void> =>
        this.guard(() => this.fail.execute(input));

    private async guard<T>(run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (err) {
            if (!(err instanceof Error)) throw err;
            if (isNonRetryableTitleError(err)) {
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
