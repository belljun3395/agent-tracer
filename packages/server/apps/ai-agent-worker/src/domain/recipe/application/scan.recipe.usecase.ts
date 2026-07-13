import { APP_SETTING_KEYS } from "@monitor/kernel";
import { generateUlid, type IClock } from "@monitor/platform";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import {
    attemptRecordFromFailure,
    attemptRecordFromSuccess,
} from "~ai-agent-worker/support/llm/job.attempt.js";
import { assignStepIds, type AgentAttemptRun } from "~ai-agent-worker/support/llm/job.step.js";
import { assembleRecipeCandidates } from "~ai-agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type {
    RecipeScanGenerateOutput,
    RecipeScanPrep,
} from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";
import type { RecipeAgentRegistry } from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { RecipeRepositoryPort } from "~ai-agent-worker/domain/recipe/port/recipe.repository.port.js";

/** 에이전트를 한 번 실행해 레시피 후보를 만들고 시도 이력을 남긴다. */
export class ScanRecipeUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly agents: RecipeAgentRegistry,
        private readonly clock: IClock,
    ) {}

    async execute(prep: RecipeScanPrep, run: AgentAttemptRun): Promise<RecipeScanGenerateOutput> {
        const agent = this.agents[prep.agentBackend];
        const apiKey = agent.requiresLocalApiKey()
            ? await this.repository.readSetting(APP_SETTING_KEYS.anthropicApiKey)
            : null;

        let output;
        try {
            output = await agent.generate({
                jobId: prep.jobId,
                userId: prep.userId,
                taskId: prep.taskId,
                language: prep.language,
                ...(apiKey !== null ? { apiKey } : {}),
                ...(prep.model !== undefined ? { model: prep.model } : {}),
                ...(prep.userPrompt !== undefined ? { userPrompt: prep.userPrompt } : {}),
                idempotencyKey: run.idempotencyKey,
                abortSignal: run.abortSignal,
            });
        } catch (err) {
            if (err instanceof AgentExecutionFailure) await this.recordFailure(prep, run.attempt, err);
            throw err;
        }

        const now = this.clock.now();
        const citedTaskIds = [
            ...new Set(output.recipes.flatMap((recipe) => recipe.contributing_slices.map((slice) => slice.taskId))),
        ];
        const ownedTaskIds = new Set(await this.repository.findOwnedTaskIds(prep.userId, citedTaskIds));
        const recipes = assembleRecipeCandidates(output.recipes, ownedTaskIds, output.provenance, () =>
            generateUlid(now.getTime()),
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
            recipes,
            jobSteps,
            attempt: run.attempt,
            attempts,
        };
    }

    private async recordFailure(prep: RecipeScanPrep, attempt: number, err: AgentExecutionFailure): Promise<void> {
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
