import { APP_SETTING_KEYS, DEFAULT_USER_ID } from "@monitor/kernel";
import { generateUlid, type IClock } from "@monitor/platform";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import {
    attemptRecordFromFailure,
    attemptRecordFromSuccess,
} from "~ai-agent-worker/support/llm/job.attempt.js";
import { assignStepIds, type AgentAttemptRun } from "~ai-agent-worker/support/llm/job.step.js";
import type {
    TaskCleanupGenerateOutput,
    TaskCleanupPrep,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";
import { assembleCleanupSuggestions } from "~ai-agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";
import type { CleanupAgentRegistry } from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { CleanupRepositoryPort } from "~ai-agent-worker/domain/cleanup/port/cleanup.repository.port.js";

/** 에이전트를 한 번 실행해 보관 제안을 만들고 시도 이력을 남긴다. */
export class SuggestCleanupUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly agents: CleanupAgentRegistry,
        private readonly clock: IClock,
    ) {}

    async execute(prep: TaskCleanupPrep, run: AgentAttemptRun): Promise<TaskCleanupGenerateOutput> {
        const agent = this.agents[prep.agentBackend];
        const apiKey = agent.requiresLocalApiKey()
            ? await this.repository.readSetting(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicApiKey)
            : null;

        let output;
        try {
            output = await agent.generate({
                jobId: prep.jobId,
                userId: prep.userId,
                language: prep.language,
                scannedAt: this.clock.now().toISOString(),
                candidates: prep.candidates,
                truncated: prep.truncated,
                maxSuggestions: prep.maxSuggestions,
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
        const suggestions = assembleCleanupSuggestions(
            output.suggestions,
            prep.candidates,
            prep.maxSuggestions,
            () => generateUlid(now.getTime()),
        );
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

    private async recordFailure(prep: TaskCleanupPrep, attempt: number, err: AgentExecutionFailure): Promise<void> {
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
