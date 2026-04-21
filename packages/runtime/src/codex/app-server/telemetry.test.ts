import { describe, expect, it } from "vitest";
import {
    buildCodexContextSnapshotEvent,
    formatCodexStatusText,
} from "./telemetry.js";

describe("Codex rollout telemetry", () => {
    it("builds a context snapshot from token usage and rate limits", () => {
        const event = buildCodexContextSnapshotEvent({
            taskId: "task_1",
            sessionId: "session_1",
            threadId: "thr_123",
            turnId: "turn_123",
            modelId: "gpt-5.4",
            tokenUsage: {
                total: {
                    totalTokens: 420000,
                    inputTokens: 300000,
                    cachedInputTokens: 20000,
                    outputTokens: 100000,
                    reasoningOutputTokens: 20000,
                },
                last: {
                    totalTokens: 420000,
                    inputTokens: 300000,
                    cachedInputTokens: 20000,
                    outputTokens: 100000,
                    reasoningOutputTokens: 20000,
                },
                modelContextWindow: 1050000,
            },
            rateLimits: {
                limitId: "codex",
                limitName: null,
                primary: {
                    usedPercent: 25,
                    windowDurationMins: 15,
                    resetsAt: 1730947200,
                },
                secondary: {
                    usedPercent: 42,
                    windowDurationMins: 60,
                    resetsAt: 1730950800,
                },
            },
        });

        expect(event).toMatchObject({
            kind: "context.snapshot",
            lane: "telemetry",
            title: "Context 40% used",
            metadata: expect.objectContaining({
                source: "codex-rollout",
                modelId: "gpt-5.4",
                contextWindowUsedPct: 40,
                contextWindowRemainingPct: 60,
                contextWindowSize: 1050000,
                contextWindowTotalTokens: 420000,
                contextWindowInputTokens: 300000,
                contextWindowOutputTokens: 100000,
                contextWindowCacheReadTokens: 20000,
                rateLimitPrimaryUsedPct: 25,
                rateLimitPrimaryWindowDurationMins: 15,
                rateLimitPrimaryResetsAt: 1730947200,
                rateLimitSecondaryUsedPct: 42,
                rateLimitSecondaryWindowDurationMins: 60,
                rateLimitSecondaryResetsAt: 1730950800,
                threadId: "thr_123",
                turnId: "turn_123",
            }),
        });
    });

    it("uses latest request usage, not cumulative session usage, for context window percentage", () => {
        const event = buildCodexContextSnapshotEvent({
            taskId: "task_1",
            sessionId: "session_1",
            modelId: "gpt-5.4",
            tokenUsage: {
                total: {
                    totalTokens: 20662952,
                    inputTokens: 20587672,
                    cachedInputTokens: 20002304,
                    outputTokens: 75280,
                    reasoningOutputTokens: 14192,
                },
                last: {
                    totalTokens: 213203,
                    inputTokens: 212839,
                    cachedInputTokens: 210304,
                    outputTokens: 364,
                    reasoningOutputTokens: 0,
                },
                modelContextWindow: 950000,
            },
        });

        expect(event).toMatchObject({
            title: "Context 22% used",
            metadata: expect.objectContaining({
                contextWindowUsedPct: 22.44,
                contextWindowRemainingPct: 77.56,
                contextWindowTotalTokens: 213203,
                contextWindowInputTokens: 212839,
                contextWindowOutputTokens: 364,
                contextWindowCacheReadTokens: 210304,
                reasoningOutputTokens: 0,
            }),
        });
    });

    it("can build a rate-limit-only context snapshot", () => {
        const event = buildCodexContextSnapshotEvent({
            taskId: "task_1",
            sessionId: "session_1",
            threadId: "thr_123",
            modelId: "gpt-5.4-mini",
            rateLimits: {
                limitId: "codex",
                limitName: null,
                primary: {
                    usedPercent: 31,
                    windowDurationMins: 15,
                    resetsAt: 1730948100,
                },
                secondary: null,
            },
        });

        expect(event).toMatchObject({
            kind: "context.snapshot",
            lane: "telemetry",
            title: "Codex status snapshot",
            metadata: expect.objectContaining({
                modelId: "gpt-5.4-mini",
                rateLimitPrimaryUsedPct: 31,
                rateLimitPrimaryWindowDurationMins: 15,
            }),
        });
        expect((event.metadata as Record<string, unknown>)["contextWindowUsedPct"]).toBeUndefined();
    });

    it("formats a status string like a lightweight statusline", () => {
        const text = formatCodexStatusText({
            tokenUsage: {
                total: {
                    totalTokens: 1000000,
                    inputTokens: 900000,
                    cachedInputTokens: 250000,
                    outputTokens: 100000,
                    reasoningOutputTokens: 15000,
                },
                last: {
                    totalTokens: 315000,
                    inputTokens: 312000,
                    cachedInputTokens: 500,
                    outputTokens: 2500,
                    reasoningOutputTokens: 500,
                },
                modelContextWindow: 1050000,
            },
            rateLimits: {
                limitId: "codex",
                limitName: null,
                primary: {
                    usedPercent: 25,
                    windowDurationMins: 15,
                    resetsAt: 1730947200,
                },
                secondary: null,
            },
        });

        expect(text).toBe("[monitor] ctx 30% · 15m 25%");
    });
});
