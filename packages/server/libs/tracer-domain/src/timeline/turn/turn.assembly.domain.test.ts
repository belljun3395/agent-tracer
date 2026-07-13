import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { EventEntity } from "../event/event.entity.js";
import { TurnEntity } from "./turn.entity.js";
import { TurnAssembly } from "./turn.assembly.domain.js";

function makeEvent(overrides: {
    readonly kind: string;
    readonly sessionId?: string | null;
    readonly taskId?: string;
    readonly body?: string | null;
    readonly title?: string;
    readonly occurredAt?: Date;
}): EventEntity {
    const event = new EventEntity();
    event.kind = overrides.kind as EventEntity["kind"];
    event.sessionId = "sessionId" in overrides ? (overrides.sessionId ?? null) : "session-1";
    event.taskId = overrides.taskId ?? "task-1";
    event.body = overrides.body ?? null;
    event.title = overrides.title ?? "";
    event.occurredAt = overrides.occurredAt ?? new Date("2026-01-01T00:00:00.000Z");
    return event;
}

describe("TurnAssembly", () => {
    it("사용자 메시지는 새 턴을 연다", () => {
        const assembly = new TurnAssembly(null, 0);
        const event = makeEvent({ kind: KIND.userMessage, body: "질문" });
        const result = assembly.apply(event);
        expect(result.action).toBe("open");
        if (result.action === "open") {
            expect(result.turn.askedText).toBe("질문");
            expect(result.turn.turnIndex).toBe(1);
        }
    });

    it("사용자 메시지에 sessionId가 없으면 아무 것도 하지 않는다", () => {
        const assembly = new TurnAssembly(null, 0);
        const event = makeEvent({ kind: KIND.userMessage, sessionId: null });
        expect(assembly.apply(event)).toEqual({ action: "none" });
    });

    it("열린 턴이 있는 상태에서 새 사용자 메시지가 오면 이전 턴을 응답 없이 닫는다", () => {
        const openTurn = TurnEntity.open("session-1", "task-1", 0, "이전 질문", new Date("2026-01-01T00:00:00.000Z"));
        const assembly = new TurnAssembly(openTurn, 0);
        const event = makeEvent({ kind: KIND.userMessage, body: "새 질문", occurredAt: new Date("2026-01-01T00:05:00.000Z") });
        assembly.apply(event);
        expect(openTurn.isOpen()).toBe(false);
        expect(openTurn.assistantText).toBeNull();
    });

    it("어시스턴트 응답은 열린 턴을 닫는다", () => {
        const openTurn = TurnEntity.open("session-1", "task-1", 0, "질문", new Date("2026-01-01T00:00:00.000Z"));
        const assembly = new TurnAssembly(openTurn, 0);
        const event = makeEvent({ kind: KIND.assistantResponse, body: "답변" });
        const result = assembly.apply(event);
        expect(result.action).toBe("close");
        expect(openTurn.assistantText).toBe("답변");
    });

    it("열린 턴이 없을 때 어시스턴트 응답은 아무 것도 하지 않는다", () => {
        const assembly = new TurnAssembly(null, 0);
        const event = makeEvent({ kind: KIND.assistantResponse, body: "답변" });
        expect(assembly.apply(event)).toEqual({ action: "none" });
    });

    it("중간 어시스턴트 발화는 열린 턴을 닫지 않고 소속만 부여한다", () => {
        const openTurn = TurnEntity.open("session-1", "task-1", 0, "질문", new Date("2026-01-01T00:00:00.000Z"));
        const assembly = new TurnAssembly(openTurn, 0);
        const event = makeEvent({ kind: KIND.assistantCommentary, body: "진행 중입니다" });

        expect(assembly.apply(event)).toEqual({ action: "attach", turnId: openTurn.id });
        expect(openTurn.isOpen()).toBe(true);
        expect(openTurn.assistantText).toBeNull();
    });

    it("그 밖의 이벤트는 열린 턴에 소속만 부여한다", () => {
        const openTurn = TurnEntity.open("session-1", "task-1", 0, "질문", new Date("2026-01-01T00:00:00.000Z"));
        const assembly = new TurnAssembly(openTurn, 0);
        const event = makeEvent({ kind: KIND.executeTool });
        const result = assembly.apply(event);
        expect(result).toEqual({ action: "attach", turnId: openTurn.id });
    });

    it("열린 턴이 없으면 그 밖의 이벤트도 아무 것도 하지 않는다", () => {
        const assembly = new TurnAssembly(null, 0);
        const event = makeEvent({ kind: KIND.executeTool });
        expect(assembly.apply(event)).toEqual({ action: "none" });
    });
});
