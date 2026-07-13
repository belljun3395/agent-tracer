import { APP_SETTING_KEYS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import { FakeRecipeAgent } from "~ai-agent-worker/domain/recipe/port/__fakes__/fake.recipe.agent.js";
import { CapturingRecipeNotification } from "~ai-agent-worker/domain/recipe/port/__fakes__/capturing.recipe.notification.js";
import { InMemoryRecipeRepository } from "~ai-agent-worker/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import type { GenerateRecipeCandidatesOutput, RecipeAgentRegistry } from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { RecipeScanPrep } from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";

export const NOW = new Date("2026-07-14T00:00:00.000Z");

export const fixedClock: IClock = {
    now: () => NOW,
    nowMs: () => NOW.getTime(),
    nowIso: () => NOW.toISOString(),
};

export function seedRepository(): InMemoryRecipeRepository {
    const repository = new InMemoryRecipeRepository();
    repository.seedJob({ id: "job-1", userId: "user-1", taskId: "task-1", usage: {} });
    repository.settings.set(APP_SETTING_KEYS.anthropicApiKey, "sk-test");
    repository.anchors.set("task-1", { ownedByUser: true, scanEligible: true, sessionScanEligible: true });
    return repository;
}

export function agentRegistry(agent: FakeRecipeAgent): RecipeAgentRegistry {
    return { [AGENT_BACKEND.python]: agent, [AGENT_BACKEND.claudeSdk]: agent };
}

export function emptyOutput(
    overrides: Partial<GenerateRecipeCandidatesOutput> = {},
): GenerateRecipeCandidatesOutput {
    return {
        recipes: [],
        modelUsed: "claude-haiku-4-5",
        durationMs: 1200,
        costUsd: 0.01,
        numTurns: 2,
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        provenance: { eventIdsByTask: {}, ruleIds: [], recipeRevs: {} },
        ...overrides,
    };
}

export function prep(): RecipeScanPrep {
    return {
        jobId: "job-1",
        userId: "user-1",
        taskId: "task-1",
        agentBackend: AGENT_BACKEND.python,
        language: OUTPUT_LANGUAGE.ko,
    };
}

export function attemptRun(attempt = 1): { attempt: number; idempotencyKey: string; abortSignal: AbortSignal } {
    return { attempt, idempotencyKey: "wf-1-act-1", abortSignal: new AbortController().signal };
}

export { CapturingRecipeNotification, FakeRecipeAgent, InMemoryRecipeRepository };
