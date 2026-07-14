import {RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SEVERITY} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {
    describeRuleExpectation,
    formatRulesContext,
    selectAnnouncedRules,
} from "~runtime/domain/guardrail/model/rules.context.model.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";

function rule(overrides: Partial<GuardrailRule> = {}): GuardrailRule {
    return {
        name: "테스트를 실행한다",
        severity: RULE_SEVERITY.block,
        taskId: "task-1",
        reviewState: RULE_REVIEW_STATE.active,
        anchorEventId: "anchor-1",
        expectation: {kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"]},
        ...overrides,
    };
}

describe("formatRulesContext", () => {
    it("규칙이 없으면 아무것도 주입하지 않는다", () => {
        expect(formatRulesContext([])).toBe("");
    });

    it("규칙 이름은 사용자가 쓴 언어 그대로 두고 지시문만 영어로 낸다", () => {
        const context = formatRulesContext([rule()]);

        expect(context).toContain("<agent-tracer-rules>");
        expect(context).toContain("- [block] 테스트를 실행한다 — must run: npm test");
        expect(context).toContain("Answer the user in the language they wrote in");
    });

    it("이행 증거가 도구 호출임을 못 박는다", () => {
        expect(formatRulesContext([rule()]))
            .toContain("Stating that you did something is not evidence; the tool call is.");
    });
});

describe("selectAnnouncedRules", () => {
    it("심각도가 높은 규칙을 먼저 알린다", () => {
        const announced = selectAnnouncedRules([
            rule({name: "info", severity: RULE_SEVERITY.info}),
            rule({name: "block", severity: RULE_SEVERITY.block}),
            rule({name: "warn", severity: RULE_SEVERITY.warn}),
        ]);

        expect(announced.map((item) => item.name)).toEqual(["block", "warn", "info"]);
    });
});

describe("describeRuleExpectation", () => {
    it("기대 변형마다 수행할 행동을 한 줄로 낸다", () => {
        expect(describeRuleExpectation(rule())).toBe("must run: npm test");
        expect(describeRuleExpectation(rule({
            expectation: {kind: RULE_EXPECTATION_KIND.pattern, pattern: "README\\.md"},
        }))).toBe("must match: README\\.md");
        expect(describeRuleExpectation(rule({
            expectation: {kind: RULE_EXPECTATION_KIND.action, tool: "file-write"},
        }))).toBe("must use: file-write");
    });
});
