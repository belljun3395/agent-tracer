import { describe, expect, it } from "vitest";
import { isEventVerified, isRuleVerified, isTurnVerified, ProvenanceLedger, verifiedRecipeRev } from "./recipe.provenance.model.js";

function event(id: string, turnId: string): { id: string; seq: string; turnId: string; kind: string; title: string; filePaths: readonly string[]; occurredAt: string } {
    return { id, seq: id, turnId, kind: "execute_tool", title: "x", filePaths: [], occurredAt: "2026-07-14T00:00:00.000Z" };
}

describe("ProvenanceLedger.mergeFrom", () => {
    it("다른 장부가 모은 이벤트와 turn을 이 장부로 흡수한다", () => {
        const coordinator = new ProvenanceLedger();
        const probe = new ProvenanceLedger();
        probe.recordEvents("task-1", [event("event-1", "turn-1")]);

        coordinator.mergeFrom(probe);

        const snapshot = coordinator.snapshot();
        expect(isEventVerified(snapshot, "task-1", "event-1")).toBe(true);
        expect(isTurnVerified(snapshot, "task-1", "turn-1")).toBe(true);
    });

    it("다른 장부의 규칙과 레시피 개정도 함께 흡수한다", () => {
        const coordinator = new ProvenanceLedger();
        const probe = new ProvenanceLedger();
        probe.recordRules(["rule-1"]);
        probe.recordRecipe("recipe-1", 3);

        coordinator.mergeFrom(probe);

        const snapshot = coordinator.snapshot();
        expect(isRuleVerified(snapshot, "rule-1")).toBe(true);
        expect(verifiedRecipeRev(snapshot, "recipe-1")).toBe(3);
    });

    it("여러 전문가의 장부를 합쳐도 서로의 관측을 지우지 않는다", () => {
        const coordinator = new ProvenanceLedger();
        const timeline = new ProvenanceLedger();
        timeline.recordEvents("task-1", [event("event-1", "turn-1")]);
        const repetition = new ProvenanceLedger();
        repetition.recordEvents("task-2", [event("event-2", "turn-2")]);

        coordinator.mergeFrom(timeline);
        coordinator.mergeFrom(repetition);

        const snapshot = coordinator.snapshot();
        expect(isEventVerified(snapshot, "task-1", "event-1")).toBe(true);
        expect(isEventVerified(snapshot, "task-2", "event-2")).toBe(true);
    });
});
