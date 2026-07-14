import {RULE_SEVERITY, VERDICT_STATUS} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {formatBlockReason, selectBlockingVerdicts} from "~runtime/domain/guardrail/model/enforce.model.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";

function verdict(overrides: Partial<GuardrailVerdict> = {}): GuardrailVerdict {
    return {
        ruleName: "테스트를 실행한다",
        severity: RULE_SEVERITY.block,
        status: VERDICT_STATUS.contradicted,
        expectedPattern: "npm test",
        actualToolCallCount: 3,
        ...overrides,
    };
}

describe("selectBlockingVerdicts", () => {
    it("미이행이면서 턴을 붙잡는 심각도만 고른다", () => {
        const blocking = selectBlockingVerdicts([
            verdict({ruleName: "block-unmet"}),
            verdict({ruleName: "info-unmet", severity: RULE_SEVERITY.info}),
            verdict({ruleName: "block-met", status: VERDICT_STATUS.verified}),
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
