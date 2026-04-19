import { describe, it, expect } from "vitest";
import { getTokenSummary } from "./aggregation.js";
import type { TimelineEventRecord } from "../../types.js";

function makeTokenUsageEvent(overrides: Partial<TimelineEventRecord> & { metadata: Record<string, unknown> }): TimelineEventRecord {
    return {
        id: "evt_1",
        kind: "token.usage",
        taskId: "task_1",
        title: "API call",
        createdAt: new Date().toISOString(),
        lane: "background",
        classification: { tags: [], confidence: 1 },
        ...overrides,
    } as unknown as TimelineEventRecord;
}

describe("getTokenSummary — token.usage events", () => {
    it("sums tokens from token.usage events", () => {
        const timeline: TimelineEventRecord[] = [
            makeTokenUsageEvent({ metadata: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 20, cacheCreateTokens: 10 } }),
            makeTokenUsageEvent({ metadata: { inputTokens: 200, outputTokens: 80, cacheReadTokens: 0, cacheCreateTokens: 5 } }),
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(300);
        expect(summary.totalOutput).toBe(130);
        expect(summary.totalCacheRead).toBe(20);
        expect(summary.totalCacheCreate).toBe(15);
        expect(summary.turnCount).toBe(2);
    });

    it("still reads tokens from legacy assistant.response events", () => {
        const timeline: TimelineEventRecord[] = [
            {
                id: "evt_2",
                kind: "assistant.response",
                taskId: "task_1",
                title: "Response",
                createdAt: new Date().toISOString(),
                lane: "user",
                classification: { tags: [], confidence: 1 },
                metadata: { inputTokens: 50, outputTokens: 25, cacheReadTokens: 0, cacheCreateTokens: 0 },
            } as unknown as TimelineEventRecord,
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(50);
        expect(summary.turnCount).toBe(1);
    });

    it("skips assistant.response events with no token data", () => {
        const timeline: TimelineEventRecord[] = [
            {
                id: "evt_3",
                kind: "assistant.response",
                taskId: "task_1",
                title: "Response (no tokens)",
                createdAt: new Date().toISOString(),
                lane: "user",
                classification: { tags: [], confidence: 1 },
                metadata: { stopReason: "end_turn", source: "otlp" },
            } as unknown as TimelineEventRecord,
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(0);
        expect(summary.turnCount).toBe(0);
    });
});
