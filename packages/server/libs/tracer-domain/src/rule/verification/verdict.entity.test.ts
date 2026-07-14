import { describe, expect, it } from "vitest";
import { VerdictEntity } from "./verdict.entity.js";
import { NUDGE_LIMIT, RULE_SEVERITY, VERDICT_STATUS, type VerdictEvidence } from "@monitor/kernel";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-01T01:00:00.000Z");

function evidence(): VerdictEvidence {
    return { actualToolCalls: [], matchedToolCalls: [], unclassifiedEventIds: [], enforcements: [] };
}

function openVerdict(): VerdictEntity {
    return VerdictEntity.open("rule-1", "turn-1", RULE_SEVERITY.block, evidence(), NOW);
}

describe("VerdictEntity", () => {
    it("열린 판정은 규칙과 심각도를 함께 들고 태어난다", () => {
        const verdict = openVerdict();

        expect(verdict.ruleId).toBe("rule-1");
        expect(verdict.status).toBe(VERDICT_STATUS.open);
        expect(verdict.severity).toBe(RULE_SEVERITY.block);
        expect(verdict.nudgeCount).toBe(0);
        expect(verdict.isOpen()).toBe(true);
    });

    describe("advance", () => {
        it("살아 있는 판정은 새 창의 결론으로 전진한다", () => {
            const verdict = openVerdict();

            verdict.advance("turn-2", VERDICT_STATUS.satisfied, evidence(), LATER);

            expect(verdict.status).toBe(VERDICT_STATUS.satisfied);
            expect(verdict.turnId).toBe("turn-2");
            expect(verdict.isOpen()).toBe(false);
        });

        it("종결된 판정은 다시 열리지 않는다", () => {
            const verdict = openVerdict();
            verdict.advance("turn-2", VERDICT_STATUS.satisfied, evidence(), LATER);

            verdict.advance("turn-3", VERDICT_STATUS.open, evidence(), LATER);

            expect(verdict.status).toBe(VERDICT_STATUS.satisfied);
            expect(verdict.turnId).toBe("turn-2");
        });
    });

    describe("recordNudge", () => {
        it("상한만큼 알리면 사람에게 넘어간다", () => {
            const verdict = openVerdict();

            for (let count = 0; count < NUDGE_LIMIT; count += 1) {
                expect(verdict.isEscalated()).toBe(false);
                verdict.recordNudge(LATER);
            }

            expect(verdict.nudgeCount).toBe(NUDGE_LIMIT);
            expect(verdict.isEscalated()).toBe(true);
        });
    });

    describe("concludeTask", () => {
        it("태스크가 끝나면 살아 있던 판정은 미이행으로 확정된다", () => {
            const verdict = openVerdict();

            verdict.concludeTask(LATER);

            expect(verdict.status).toBe(VERDICT_STATUS.unmet);
        });

        it("이미 이행된 판정은 그대로 둔다", () => {
            const verdict = openVerdict();
            verdict.advance("turn-2", VERDICT_STATUS.satisfied, evidence(), LATER);

            verdict.concludeTask(LATER);

            expect(verdict.status).toBe(VERDICT_STATUS.satisfied);
        });
    });
});
