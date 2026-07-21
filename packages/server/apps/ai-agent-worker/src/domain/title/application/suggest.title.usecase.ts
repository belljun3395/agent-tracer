import { APP_SETTING_KEYS, DEFAULT_USER_ID } from "@monitor/kernel";
import { generateUlid, type IClock } from "@monitor/platform";
import { AgentExecutionFailure, assignStepIds, type AgentAttemptRun } from "@monitor/llm-runtime";
import { attemptRecordFromFailure, attemptRecordFromSuccess } from "~ai-agent-worker/support/llm/job.attempt.js";
import type {
    TitleSuggestionGenerateOutput,
    TitleSuggestionPrep,
} from "~ai-agent-worker/domain/title/model/title.job.model.js";
import { dedupeTitleSuggestions } from "~ai-agent-worker/domain/title/model/title.suggestion.model.js";
import type { TitleAgentRegistry } from "~ai-agent-worker/domain/title/port/title.agent.port.js";
import type { TitleRepositoryPort } from "~ai-agent-worker/domain/title/port/title.repository.port.js";

/** 에이전트를 한 번 실행해 제목 후보를 만들고 시도 이력을 남긴다. */
export class SuggestTitleUsecase {
    constructor(
        private readonly repository: TitleRepositoryPort,
        private readonly agents: TitleAgentRegistry,
        private readonly clock: IClock,
    ) {}

    async execute(prep: TitleSuggestionPrep, run: AgentAttemptRun): Promise<TitleSuggestionGenerateOutput> {
        const agent = this.agents[prep.agentBackend];
        const apiKey = agent.requiresLocalApiKey()
            ? await this.repository.readSetting(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicApiKey)
            : null;

        let output;
        try {
            output = await agent.generate({
                jobId: prep.jobId,
                userId: prep.userId,
                taskId: prep.taskId,
                language: prep.language,
                context: prep.context,
                ...(apiKey !== null ? { apiKey } : {}),
                ...(prep.model !== undefined ? { model: prep.model } : {}),
                idempotencyKey: run.idempotencyKey,
                abortSignal: run.abortSignal,
            });
        } catch (err) {
            if (err instanceof AgentExecutionFailure) await this.recordFailure(prep, run.attempt, err);
            throw err;
        }

        const now = this.clock.now();
        const suggestions = dedupeTitleSuggestions(output.suggestions, prep.currentTitle);
        const jobSteps = assignStepIds(output.steps, () => generateUlid(now.getTime()));

        const { attempts, costUsd } = await this.repository.foldSuccessAttempt(
            prep.jobId,
            attemptRecordFromSuccess(run.attempt, output),
        );

        return {
            modelUsed: output.modelUsed,
            durationMs: output.durationMs,
            costUsd,
            numTurns: output.numTurns,
            usage: output.usage,
            suggestions,
            jobSteps,
            attempt: run.attempt,
            attempts,
        };
    }

    private async recordFailure(
        prep: TitleSuggestionPrep,
        attempt: number,
        err: AgentExecutionFailure,
    ): Promise<void> {
        const now = this.clock.now();
        await this.repository.recordFailedAttempt({
            jobId: prep.jobId,
            userId: prep.userId,
            steps: assignStepIds(err.steps, () => generateUlid(now.getTime())),
            record: attemptRecordFromFailure(attempt, err),
            now,
        });
    }
}
