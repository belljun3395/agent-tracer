import {describe, expect, it} from "vitest";
import {
    buildRuleProposalPolicy,
    GUIDELINE_CLAUSE,
    resolveRuleLanguageDirective,
    type RuleProposalPolicyOptions,
} from "~runtime/domain/rulegen/model/proposal.policy.model.js";
import {RULEGEN_MODE, type RulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {buildSeverityGuidance} from "~runtime/domain/rulegen/model/severity.clause.model.js";

function policyFor(mode: RulegenMode, overrides: Partial<RuleProposalPolicyOptions> = {}): string {
    return buildRuleProposalPolicy({
        mode,
        maxRules: 5,
        language: "auto",
        anchorDirective: "",
        intentDirective: "",
        ...overrides,
    });
}

describe("resolveRuleLanguageDirective", () => {
    it("알려진 언어는 그 언어로 쓰라고 지시한다", () => {
        expect(resolveRuleLanguageDirective("ko")).toContain("한국어");
        expect(resolveRuleLanguageDirective("en")).toContain("English");
        expect(resolveRuleLanguageDirective("ja")).toContain("日本語");
        expect(resolveRuleLanguageDirective("zh")).toContain("简体中文");
    });

    it("모르는 언어는 태스크의 언어를 따르라는 auto로 물러선다", () => {
        expect(resolveRuleLanguageDirective("fr")).toBe(resolveRuleLanguageDirective("auto"));
    });
});

describe("buildRuleProposalPolicy", () => {
    it("두 모드 모두 필드와 심각도와 언어 정책을 싣는다", () => {
        for (const mode of [RULEGEN_MODE.manual, RULEGEN_MODE.recent]) {
            const policy = policyFor(mode, {language: "ko"});
            expect(policy).toContain("Each rule has:");
            expect(policy).toContain(buildSeverityGuidance(mode));
            expect(policy).toContain(GUIDELINE_CLAUSE.obligationsFromRequest);
            expect(policy).toContain(GUIDELINE_CLAUSE.zeroIsCorrect);
            expect(policy).toContain(`Output language: ${resolveRuleLanguageDirective("ko")}`);
        }
    });

    it("수동 생성은 이 태스크 고유 패턴을 노리라 하고 3-5개를 요구한다", () => {
        const policy = policyFor(RULEGEN_MODE.manual, {maxRules: 5});
        expect(policy).toContain(GUIDELINE_CLAUSE.taskSpecific);
        expect(policy).toContain("Output exactly 3-5 rules.");
    });

    it("수동 생성도 상한이 3 이하면 하한을 함께 낮춰 정확한 개수를 요구한다", () => {
        expect(policyFor(RULEGEN_MODE.manual, {maxRules: 2})).toContain("Output exactly 2 rules.");
    });

    it("자동 트리거는 기존 규칙과 겹치지 말라 하고 1-2개로 묶으며 고유 패턴 절은 빼놓는다", () => {
        const policy = policyFor(RULEGEN_MODE.recent, {maxRules: 2});
        expect(policy).toContain(GUIDELINE_CLAUSE.noOverlapWithExisting);
        expect(policy).toContain("Output 1-2 rules, never more than 2.");
        expect(policy).not.toContain(GUIDELINE_CLAUSE.taskSpecific);
    });

    it("앵커와 의도 지침을 그대로 이어 붙인다", () => {
        const policy = policyFor(RULEGEN_MODE.manual, {
            anchorDirective: "ANCHOR-DIRECTIVE",
            intentDirective: "INTENT-DIRECTIVE",
        });
        expect(policy).toContain("ANCHOR-DIRECTIVE");
        expect(policy).toContain("INTENT-DIRECTIVE");
    });
});
