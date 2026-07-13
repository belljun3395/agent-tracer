import { APP_SETTING_KEYS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import {
    CLEANUP_CANDIDATE_REASON,
    type CleanupCandidate,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import { CapturingCleanupNotification } from "~ai-agent-worker/domain/cleanup/port/__fakes__/capturing.cleanup.notification.js";
import { FakeCleanupAgent } from "~ai-agent-worker/domain/cleanup/port/__fakes__/fake.cleanup.agent.js";
import { InMemoryCleanupRepository } from "~ai-agent-worker/domain/cleanup/port/__fakes__/in-memory.cleanup.repository.js";
import type {
    CleanupAgentRegistry,
    GenerateCleanupSuggestionsOutput,
} from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { TaskCleanupPrep } from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";

export const NOW = new Date("2026-07-14T00:00:00.000Z");
const LONG_AGO = new Date("2026-01-01T00:00:00.000Z").toISOString();

export const fixedClock: IClock = {
    now: () => NOW,
    nowMs: () => NOW.getTime(),
    nowIso: () => NOW.toISOString(),
};

export function candidate(overrides: Partial<CleanupCandidate> = {}): CleanupCandidate {
    return {
        id: "task-1",
        visibleTitle: "테스트",
        status: "completed",
        lastEventAt: null,
        hasEvents: false,
        activeChildCount: 0,
        candidateReasons: [CLEANUP_CANDIDATE_REASON.noEvents],
        ...overrides,
    };
}

export function seedRepository(): InMemoryCleanupRepository {
    const repository = new InMemoryCleanupRepository();
    repository.seedJob({ id: "job-1", userId: "user-1", usage: {} });
    repository.settings.set(APP_SETTING_KEYS.anthropicApiKey, "sk-test");
    repository.batch = {
        tasks: [
            { id: "task-1", title: "테스트", status: "completed", lastEventAt: null, updatedAt: LONG_AGO },
            { id: "task-2", title: "인증 미들웨어 수정", status: "completed", lastEventAt: LONG_AGO, updatedAt: LONG_AGO },
        ],
        activeChildParentIds: [],
        truncated: false,
        tasksScanned: 2,
    };
    return repository;
}

export function agentRegistry(agent: FakeCleanupAgent): CleanupAgentRegistry {
    return { [AGENT_BACKEND.python]: agent, [AGENT_BACKEND.claudeSdk]: agent };
}

export function emptyOutput(
    overrides: Partial<GenerateCleanupSuggestionsOutput> = {},
): GenerateCleanupSuggestionsOutput {
    return {
        suggestions: [],
        modelUsed: "claude-haiku-4-5",
        durationMs: 1500,
        costUsd: 0.03,
        numTurns: 4,
        usage: { inputTokens: 20, outputTokens: 8, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        ...overrides,
    };
}

export function prep(overrides: Partial<TaskCleanupPrep> = {}): TaskCleanupPrep {
    return {
        jobId: "job-1",
        userId: "user-1",
        agentBackend: AGENT_BACKEND.python,
        language: OUTPUT_LANGUAGE.ko,
        maxSuggestions: 20,
        candidates: [candidate()],
        truncated: false,
        tasksScanned: 2,
        ...overrides,
    };
}

export function attemptRun(attempt = 1): { attempt: number; idempotencyKey: string; abortSignal: AbortSignal } {
    return { attempt, idempotencyKey: "wf-1-act-1", abortSignal: new AbortController().signal };
}

export { CapturingCleanupNotification, FakeCleanupAgent, InMemoryCleanupRepository };
