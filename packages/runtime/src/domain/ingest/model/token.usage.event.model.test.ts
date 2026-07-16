import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {tokenUsageEvent} from "~runtime/domain/ingest/model/token.usage.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"};

/** 훅 번들 자립 규칙 때문에 서버 telemetry 스키마를 값으로 import할 수 없어 strict 키 목록을 여기 고정값으로 대조한다. */
const ALLOWED_TELEMETRY_PAYLOAD_KEYS = new Set([
    "title", "body", "lane", "metadata",
    "inputTokens", "outputTokens", "cacheReadTokens", "cacheCreateTokens",
    "costUsd", "durationMs", "model", "promptId",
]);

describe("tokenUsageEvent", () => {
    it("RunEventInput을 만들고 payload 최상위 키가 strict 목록을 벗어나지 않는다", () => {
        const event = tokenUsageEvent(TARGET, {
            eventId: "event-1",
            messageId: "message-1",
            source: "claude-transcript",
            assistantUuid: "assistant-1",
            inputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 5,
            cacheCreateTokens: 0,
            model: "claude-sonnet",
            requestId: "request-1",
        });

        expect(event.id).toBe("event-1");
        expect(event.kind).toBe(KIND.tokenUsage);
        expect(event.taskId).toBe("task-1");
        expect(event.sessionId).toBe("session-1");
        expect(event.turnId).toBe("turn-1");

        for (const key of Object.keys(event.payload)) {
            expect(ALLOWED_TELEMETRY_PAYLOAD_KEYS.has(key)).toBe(true);
        }
        expect(event.payload).toEqual({
            lane: "telemetry",
            inputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 5,
            cacheCreateTokens: 0,
            model: "claude-sonnet",
            promptId: "request-1",
            metadata: {
                evidenceLevel: "proven",
                evidenceReason: "Claude Code transcript의 message.usage를 직접 수집했다.",
                messageId: "message-1",
                source: "claude-transcript",
                assistantUuid: "assistant-1",
            },
        });
    });

    it("model과 requestId가 없으면 그 키를 아예 싣지 않는다", () => {
        const event = tokenUsageEvent(TARGET, {
            eventId: "event-2",
            messageId: "message-2",
            source: "claude-transcript",
            assistantUuid: "assistant-2",
            inputTokens: 1,
            outputTokens: 2,
            cacheReadTokens: 0,
            cacheCreateTokens: 0,
        });

        expect(event.payload).not.toHaveProperty("model");
        expect(event.payload).not.toHaveProperty("promptId");
        for (const key of Object.keys(event.payload)) {
            expect(ALLOWED_TELEMETRY_PAYLOAD_KEYS.has(key)).toBe(true);
        }
    });
});
