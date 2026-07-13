import { AGENT_TRACER_ATTR } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { EventEntity } from "./event.entity.js";

function makeEvent(kind: string): EventEntity {
    const event = new EventEntity();
    event.kind = kind as EventEntity["kind"];
    event.turnId = null;
    return event;
}

describe("EventEntity", () => {
    describe("isUserMessage", () => {
        it("kind가 user.message면 true를 반환한다", () => {
            expect(makeEvent(KIND.userMessage).isUserMessage()).toBe(true);
        });

        it("kind가 다른 값이면 false를 반환한다", () => {
            expect(makeEvent(KIND.assistantResponse).isUserMessage()).toBe(false);
        });
    });

    describe("isAssistantResponse", () => {
        it("kind가 assistant.response면 true를 반환한다", () => {
            expect(makeEvent(KIND.assistantResponse).isAssistantResponse()).toBe(true);
        });

        it("kind가 다른 값이면 false를 반환한다", () => {
            expect(makeEvent(KIND.userMessage).isAssistantResponse()).toBe(false);
            expect(makeEvent(KIND.assistantCommentary).isAssistantResponse()).toBe(false);
        });
    });

    describe("isAssistantCommentary", () => {
        it("중간 발화만 true를 반환한다", () => {
            expect(makeEvent(KIND.assistantCommentary).isAssistantCommentary()).toBe(true);
            expect(makeEvent(KIND.assistantResponse).isAssistantCommentary()).toBe(false);
        });
    });

    describe("turnResponseEventId", () => {
        it("metadata의 턴 최종 응답 이벤트 ID를 반환한다", () => {
            const event = makeEvent(KIND.assistantCommentary);
            event.metadata = { [AGENT_TRACER_ATTR.turnResponseEventId]: "response-1" };

            expect(event.turnResponseEventId()).toBe("response-1");
        });

        it("부모 이벤트 ID가 없으면 null을 반환한다", () => {
            const event = makeEvent(KIND.assistantCommentary);
            event.metadata = {};

            expect(event.turnResponseEventId()).toBeNull();
        });
    });

    describe("attachToTurn", () => {
        it("turnId를 지정한 값으로 바꾼다", () => {
            const event = makeEvent(KIND.userMessage);
            event.attachToTurn("turn-42");
            expect(event.turnId).toBe("turn-42");
        });
    });

    describe("asyncTaskId", () => {
        it("action.logged 이벤트의 asyncTaskId 메타데이터를 반환한다", () => {
            const event = makeEvent(KIND.actionLogged);
            event.metadata = { [AGENT_TRACER_ATTR.asyncTaskId]: "agent-1" };
            expect(event.asyncTaskId()).toBe("agent-1");
        });

        it("action.logged가 아니면 메타데이터가 있어도 null을 반환한다", () => {
            const event = makeEvent(KIND.executeTool);
            event.metadata = { [AGENT_TRACER_ATTR.asyncTaskId]: "agent-1" };
            expect(event.asyncTaskId()).toBeNull();
        });

        it("asyncTaskId가 없으면 null을 반환한다", () => {
            const event = makeEvent(KIND.actionLogged);
            event.metadata = {};
            expect(event.asyncTaskId()).toBeNull();
        });
    });

    describe("isAsyncActionRunning", () => {
        it("asyncStatus가 running이면 true를 반환한다", () => {
            const event = makeEvent(KIND.actionLogged);
            event.metadata = { [AGENT_TRACER_ATTR.asyncStatus]: "running" };
            expect(event.isAsyncActionRunning()).toBe(true);
        });

        it("asyncStatus가 다른 값이면 false를 반환한다", () => {
            const event = makeEvent(KIND.actionLogged);
            event.metadata = { [AGENT_TRACER_ATTR.asyncStatus]: "completed" };
            expect(event.isAsyncActionRunning()).toBe(false);
        });
    });
});
