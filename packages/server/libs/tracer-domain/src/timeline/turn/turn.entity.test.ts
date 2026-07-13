import { describe, expect, it } from "vitest";
import { TurnEntity } from "./turn.entity.js";
import { TURN_STATUS } from "./turn.const.js";

const OPENED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("TurnEntity", () => {
    describe("open", () => {
        it("session·task·index로 열린 턴을 만든다", () => {
            const turn = TurnEntity.open("session-1", "task-1", 3, "질문", OPENED_AT);
            expect(turn.status).toBe(TURN_STATUS.open);
            expect(turn.turnIndex).toBe(3);
            expect(turn.askedText).toBe("질문");
            expect(turn.id).toBe("session-1#0003");
        });
    });

    describe("close", () => {
        it("열린 턴을 닫고 응답 텍스트를 기록한다", () => {
            const turn = TurnEntity.open("s", "t", 0, "q", OPENED_AT);
            const closedAt = new Date("2026-01-01T00:01:00.000Z");
            turn.close("답변", closedAt);
            expect(turn.status).toBe(TURN_STATUS.closed);
            expect(turn.assistantText).toBe("답변");
            expect(turn.endedAt).toEqual(closedAt);
        });

        it("이미 닫힌 턴을 다시 닫아도 최초 응답을 유지한다", () => {
            const turn = TurnEntity.open("s", "t", 0, "q", OPENED_AT);
            const firstClose = new Date("2026-01-01T00:01:00.000Z");
            turn.close("첫 응답", firstClose);
            turn.close("두 번째 응답", new Date("2026-01-01T00:02:00.000Z"));
            expect(turn.assistantText).toBe("첫 응답");
            expect(turn.endedAt).toEqual(firstClose);
        });
    });

    describe("endWithoutResponse", () => {
        it("응답 없이 턴을 닫는다", () => {
            const turn = TurnEntity.open("s", "t", 0, "q", OPENED_AT);
            const endedAt = new Date("2026-01-01T00:01:00.000Z");
            turn.endWithoutResponse(endedAt);
            expect(turn.status).toBe(TURN_STATUS.closed);
            expect(turn.assistantText).toBeNull();
            expect(turn.endedAt).toEqual(endedAt);
        });

        it("이미 닫힌 턴에는 영향을 주지 않는다", () => {
            const turn = TurnEntity.open("s", "t", 0, "q", OPENED_AT);
            const firstClose = new Date("2026-01-01T00:01:00.000Z");
            turn.close("답변", firstClose);
            turn.endWithoutResponse(new Date("2026-01-01T00:02:00.000Z"));
            expect(turn.assistantText).toBe("답변");
            expect(turn.endedAt).toEqual(firstClose);
        });
    });

    describe("isOpen", () => {
        it("열린 턴은 true를 반환한다", () => {
            expect(TurnEntity.open("s", "t", 0, "q", OPENED_AT).isOpen()).toBe(true);
        });

        it("닫힌 턴은 false를 반환한다", () => {
            const turn = TurnEntity.open("s", "t", 0, "q", OPENED_AT);
            turn.close("답변", new Date());
            expect(turn.isOpen()).toBe(false);
        });
    });

    describe("recordVerdictSummary", () => {
        it("집계 판정과 평가 건수를 기록한다", () => {
            const turn = TurnEntity.open("s", "t", 0, "q", OPENED_AT);
            turn.recordVerdictSummary("contradicted", 3);
            expect(turn.aggregateVerdict).toBe("contradicted");
            expect(turn.rulesEvaluatedCount).toBe(3);
        });
    });
});
