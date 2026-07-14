import {RULE_SEVERITY, VERDICT_STATUS} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {
    GUARDRAIL_ACTION,
    decideAction,
    formatBlockReason,
    selectBlockingVerdicts,
} from "~runtime/domain/guardrail/model/enforce.model.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";

function verdict(overrides: Partial<GuardrailVerdict> = {}): GuardrailVerdict {
    return {
        ruleId: "rule-1",
        ruleName: "테스트를 실행한다",
        severity: RULE_SEVERITY.block,
        status: VERDICT_STATUS.open,
        escalated: false,
        expectedPattern: "npm test",
        actualToolCallCount: 3,
        unclassifiedCount: 0,
        ...overrides,
    };
}

describe("decideAction", () => {
    it("이행된 판정에는 아무 말도 하지 않는다", () => {
        expect(decideAction(verdict({status: VERDICT_STATUS.satisfied}))).toBe(GUARDRAIL_ACTION.silent);
    });

    it("확신하고 턴을 붙잡을 수 있으면 막는다", () => {
        expect(decideAction(verdict())).toBe(GUARDRAIL_ACTION.block);
    });

    it("확신해도 기록만 하는 규칙이면 막지 않고 이월한다", () => {
        expect(decideAction(verdict({severity: RULE_SEVERITY.info}))).toBe(GUARDRAIL_ACTION.carry);
    });

    it("확신하지 못하면 심각도가 높아도 막지 않는다", () => {
        expect(decideAction(verdict({status: VERDICT_STATUS.unknown, unclassifiedCount: 1})))
            .toBe(GUARDRAIL_ACTION.carry);
    });

    it("상한을 넘겼으면 그만 막고 사람에게 넘긴다", () => {
        expect(decideAction(verdict({escalated: true}))).toBe(GUARDRAIL_ACTION.carry);
    });
});

describe("selectBlockingVerdicts", () => {
    it("막기로 결정된 판정만 고른다", () => {
        const blocking = selectBlockingVerdicts([
            verdict({ruleName: "block-unmet"}),
            verdict({ruleName: "info-unmet", severity: RULE_SEVERITY.info}),
            verdict({ruleName: "block-met", status: VERDICT_STATUS.satisfied}),
        ]);

        expect(blocking.map((item) => item.ruleName)).toEqual(["block-unmet"]);
    });
});

describe("formatBlockReason", () => {
    it("규칙 이름은 사용자가 쓴 언어 그대로 두고 지시문만 영어로 낸다", () => {
        const reason = formatBlockReason([verdict()]);

        expect(reason).toContain("1 rule derived from the user's request");
        expect(reason).toContain("1. '테스트를 실행한다' — expected: npm test");
        expect(reason).toContain("written in the user's language");
    });

    it("이행 주장이 증거가 아님을 못 박는다", () => {
        expect(formatBlockReason([verdict()]))
            .toContain("Claiming you already did them is not evidence");
    });

    it("판정 여럿이면 번호를 매겨 모두 알린다", () => {
        const reason = formatBlockReason([verdict({ruleName: "첫째"}), verdict({ruleName: "둘째"})]);

        expect(reason).toContain("2 rules derived from the user's request");
        expect(reason).toContain("1. '첫째'");
        expect(reason).toContain("2. '둘째'");
    });
});
