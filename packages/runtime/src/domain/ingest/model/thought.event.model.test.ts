import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {LANE} from "~runtime/domain/ingest/model/event.model.js";
import {thoughtLoggedEvent} from "~runtime/domain/ingest/model/thought.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"};

describe("thoughtLoggedEvent", () => {
    it("thinking 텍스트를 그대로 실으면 잘리지 않는다", () => {
        const event = thoughtLoggedEvent(TARGET, {
            eventId: "event-1",
            text: "짧은 생각",
            source: "claude-transcript",
            contentIndex: 0,
            assistantUuid: "assistant-1",
        });

        expect(event.id).toBe("event-1");
        expect(event.kind).toBe(KIND.thoughtLogged);
        expect(event.lane).toBe(LANE.assistant);
        expect(event.turnId).toBe("turn-1");
        expect(event.body).toBe("짧은 생각");
        expect(event.title).toBe("짧은 생각");
        expect(event.metadata).toEqual({
            evidenceLevel: "proven",
            evidenceReason: "Claude Code transcript의 thinking 블록을 직접 수집했다.",
            messageId: "event-1",
            source: "claude-transcript",
            contentIndex: 0,
            assistantUuid: "assistant-1",
            thinkingBytes: Buffer.byteLength("짧은 생각", "utf8"),
        });
    });

    it("긴 thinking은 제목만 줄이고 본문은 head/tail로 잘라 원본 바이트 수를 남긴다", () => {
        const text = "가".repeat(10_000);
        const event = thoughtLoggedEvent(TARGET, {
            eventId: "event-2",
            text,
            source: "claude-transcript",
            contentIndex: 2,
            assistantUuid: "assistant-2",
            parentUuid: "parent-2",
            requestId: "request-2",
        });

        expect(event.title).toHaveLength(120);
        expect(event.body).not.toBe(text);
        expect((event.body as string).length).toBeLessThan(text.length);
        const metadata = event.metadata as Record<string, unknown>;
        expect(metadata["thinkingBytes"]).toBe(Buffer.byteLength(text, "utf8"));
        expect(metadata["thinkingTruncated"]).toBe(true);
        expect(metadata["parentUuid"]).toBe("parent-2");
        expect(metadata["requestId"]).toBe("request-2");
    });
});
