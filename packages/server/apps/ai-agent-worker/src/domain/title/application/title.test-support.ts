import { APP_SETTING_KEYS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import type { TitleContext } from "~ai-agent-worker/domain/title/model/title.context.model.js";
import { CapturingTitleNotification } from "~ai-agent-worker/domain/title/port/__fakes__/capturing.title.notification.js";
import { FakeTitleAgent } from "~ai-agent-worker/domain/title/port/__fakes__/fake.title.agent.js";
import { InMemoryTitleRepository } from "~ai-agent-worker/domain/title/port/__fakes__/in-memory.title.repository.js";
import type {
    GenerateTitleSuggestionsOutput,
    TitleAgentRegistry,
} from "~ai-agent-worker/domain/title/port/title.agent.port.js";
import type { TitleSuggestionPrep } from "~ai-agent-worker/domain/title/model/title.job.model.js";

export const NOW = new Date("2026-07-14T00:00:00.000Z");

export const fixedClock: IClock = {
    now: () => NOW,
    nowMs: () => NOW.getTime(),
    nowIso: () => NOW.toISOString(),
};

export function titleContext(overrides: Partial<TitleContext> = {}): TitleContext {
    return {
        title: "기존 제목",
        status: "completed",
        totalEventCount: 12,
        totalTurnCount: 1,
        truncated: false,
        turns: [{ turnIndex: 0, askedText: "질문", assistantText: "답변" }],
        ...overrides,
    };
}

export function seedRepository(): InMemoryTitleRepository {
    const repository = new InMemoryTitleRepository();
    repository.seedJob({ id: "job-1", userId: "user-1", taskId: "task-1", usage: {} });
    repository.settings.set(APP_SETTING_KEYS.anthropicApiKey, "sk-test");
    repository.contexts.set("task-1", { ownedByUser: true, totalEventCount: 12, context: titleContext() });
    return repository;
}

export function agentRegistry(agent: FakeTitleAgent): TitleAgentRegistry {
    return { [AGENT_BACKEND.python]: agent, [AGENT_BACKEND.claudeSdk]: agent };
}

export function emptyOutput(
    overrides: Partial<GenerateTitleSuggestionsOutput> = {},
): GenerateTitleSuggestionsOutput {
    return {
        suggestions: [],
        modelUsed: "claude-haiku-4-5",
        durationMs: 800,
        costUsd: 0.01,
        numTurns: 1,
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        ...overrides,
    };
}

export function prep(): TitleSuggestionPrep {
    return {
        jobId: "job-1",
        userId: "user-1",
        taskId: "task-1",
        agentBackend: AGENT_BACKEND.python,
        language: OUTPUT_LANGUAGE.ko,
        currentTitle: "기존 제목",
        context: titleContext(),
    };
}

export function attemptRun(attempt = 1): { attempt: number; idempotencyKey: string; abortSignal: AbortSignal } {
    return { attempt, idempotencyKey: "wf-1-act-1", abortSignal: new AbortController().signal };
}

export { CapturingTitleNotification, FakeTitleAgent, InMemoryTitleRepository };
