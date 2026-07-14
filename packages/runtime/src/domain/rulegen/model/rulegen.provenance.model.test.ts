import {describe, expect, it} from "vitest";
import {
    RulegenProvenanceLedger,
    isEventGrounded,
    isTurnGrounded,
} from "~runtime/domain/rulegen/model/rulegen.provenance.model.js";

describe("RulegenProvenanceLedger", () => {
    it("도구가 돌려준 턴만 인용 대상에 올린다", () => {
        const ledger = new RulegenProvenanceLedger();

        ledger.recordTurns([{turnId: "turn-1", turnIndex: 1, askedText: "테스트 돌려", assistantSummary: ""}]);
        const snapshot = ledger.snapshot();

        expect(isTurnGrounded(snapshot, "turn-1")).toBe(true);
        expect(isTurnGrounded(snapshot, "turn-2")).toBe(false);
    });

    it("이벤트 응답에 실린 턴 식별자도 모델이 본 것이므로 인용을 허가한다", () => {
        const ledger = new RulegenProvenanceLedger();

        ledger.recordEvents([{eventId: "event-1", turnId: "turn-9", kind: "execute_tool", title: "", body: ""}]);
        const snapshot = ledger.snapshot();

        expect(isEventGrounded(snapshot, "event-1")).toBe(true);
        expect(isTurnGrounded(snapshot, "turn-9")).toBe(true);
    });

    it("아무 도구도 부르지 않은 실행의 장부는 비어 있다", () => {
        expect(new RulegenProvenanceLedger().snapshot()).toEqual({turnIds: [], eventIds: []});
    });

    it("같은 식별자를 두 번 돌려줘도 한 번만 담는다", () => {
        const ledger = new RulegenProvenanceLedger();
        const event = {eventId: "event-1", kind: "execute_tool", title: "", body: ""};

        ledger.recordEvents([event]);
        ledger.recordEvents([event]);

        expect(ledger.snapshot().eventIds).toEqual(["event-1"]);
    });
});
