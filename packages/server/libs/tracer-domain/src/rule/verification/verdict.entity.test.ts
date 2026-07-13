import { describe, expect, it } from "vitest";
import { VerdictEntity } from "./verdict.entity.js";
import { VERDICT_STATUS, type VerdictEvidence } from "@monitor/kernel";

const EVIDENCE: VerdictEvidence = { actualToolCalls: [], matchedToolCalls: [], enforcements: [] };

describe("VerdictEntity", () => {
    describe("record", () => {
        it("주어진 필드로 판정을 만든다", () => {
            const at = new Date("2026-01-01T00:00:00.000Z");
            const verdict = VerdictEntity.record("turn-1", "rule-1", VERDICT_STATUS.verified, EVIDENCE, at);
            expect(verdict.turnId).toBe("turn-1");
            expect(verdict.ruleId).toBe("rule-1");
            expect(verdict.status).toBe(VERDICT_STATUS.verified);
            expect(verdict.evaluatedAt).toEqual(at);
        });
    });

    describe("isContradicted", () => {
        it("status가 contradicted면 true를 반환한다", () => {
            const verdict = VerdictEntity.record("t", "r", VERDICT_STATUS.contradicted, EVIDENCE, new Date());
            expect(verdict.isContradicted()).toBe(true);
        });

        it("status가 verified면 false를 반환한다", () => {
            const verdict = VerdictEntity.record("t", "r", VERDICT_STATUS.verified, EVIDENCE, new Date());
            expect(verdict.isContradicted()).toBe(false);
        });
    });
});
