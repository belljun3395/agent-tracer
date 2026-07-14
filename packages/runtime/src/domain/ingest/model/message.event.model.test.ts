import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {LANE} from "~runtime/domain/ingest/model/event.model.js";
import {
    assistantCommentaryEvent,
    assistantResponseEvent,
    promptExpansionEvent,
    turnFailedEvent,
    userMessageEvent,
} from "~runtime/domain/ingest/model/message.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"};
const RUNTIME_SOURCE = "claude-plugin";

describe("사용자 발화 이벤트", () => {
    it("긴 프롬프트는 제목만 줄이고 본문은 온전히 싣는다", () => {
        const prompt = "가".repeat(200);
        const event = userMessageEvent(TARGET, {
            eventId: "event-1",
            messageId: "message-1",
            turnId: "turn-2",
            prompt,
            phase: "initial",
            runtimeSource: RUNTIME_SOURCE,
        });

        expect(event.kind).toBe(KIND.userMessage);
        expect(event.id).toBe("event-1");
        expect(event.turnId).toBe("turn-2");
        expect(event.title).toHaveLength(120);
        expect(event.body).toBe(prompt);
        expect((event.metadata as Record<string, unknown>)["phase"]).toBe("initial");
        expect(event.lane).toBe(LANE.user);
    });
});

describe("어시스턴트 응답 이벤트", () => {
    it("응답 본문이 없으면 종료 사유를 제목으로 쓴다", () => {
        const event = assistantResponseEvent(TARGET, {
            messageId: "message-1",
            stopReason: "end_turn",
            runtimeSource: RUNTIME_SOURCE,
        });

        expect(event.title).toBe("Response (end_turn)");
        expect(event.body).toBeUndefined();
        expect(event.lane).toBe(LANE.assistant);
    });

    it("실패한 턴은 오류 종류를 종료 사유에 접두한다", () => {
        const event = turnFailedEvent(TARGET, {
            messageId: "message-2",
            errorType: "overloaded",
            errorMessage: "서버 과부하",
            runtimeSource: RUNTIME_SOURCE,
        });

        expect(event.title).toBe("Turn failed (overloaded)");
        expect((event.metadata as Record<string, unknown>)["stopReason"]).toBe("error:overloaded");
        expect(event.lane).toBe(LANE.assistant);
    });

    it("중간 발화는 멱등키를 이벤트 ID로 쓴다", () => {
        const event = assistantCommentaryEvent(TARGET, {
            eventId: "commentary-1",
            text: "먼저 설정을 확인한다.",
            source: "claude-transcript",
            sourceId: "sub--agent-1",
            contentIndex: 2,
            assistantUuid: "uuid-1",
        });

        expect(event.kind).toBe(KIND.assistantCommentary);
        expect(event.id).toBe("commentary-1");
        expect(event.lane).toBe(LANE.assistant);
        expect((event.metadata as Record<string, unknown>)["contentIndex"]).toBe(2);
        expect((event.metadata as Record<string, unknown>)["sourceId"]).toBe("sub--agent-1");
    });
});

describe("프롬프트 확장 이벤트", () => {
    it("상한을 넘는 확장 프롬프트는 잘라 담고 원본 바이트 수를 남긴다", () => {
        const expanded = "a".repeat(2_500);
        const event = promptExpansionEvent(TARGET, {
            expansionType: "slash_command",
            commandName: "qa",
            commandArgs: "--fast",
            expandedPrompt: expanded,
        });

        expect(event.title).toBe("Slash: /qa --fast");
        const metadata = event.metadata as Record<string, unknown>;
        expect(metadata["expandedPromptBytes"]).toBe(2_500);
        expect((metadata["expandedPromptSnippet"] as string).endsWith("…")).toBe(true);
    });
});
