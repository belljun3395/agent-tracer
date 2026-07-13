import { describe, expect, it } from "vitest";
import { computeRuleSignature } from "./rule.signature.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
    type RuleTrigger,
} from "./rule.vocabulary.js";

describe("computeRuleSignature", () => {
    it("트리거와 기대 목록 순서가 달라도 같은 규칙 서명을 만든다", () => {
        const firstTrigger: RuleTrigger = { phrases: ["테스트", "린트"], on: "user" };
        const secondTrigger: RuleTrigger = { phrases: ["린트", "테스트"], on: "user" };
        const firstExpectation: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm test", "npm run lint"],
            forbiddenMatches: ["--force", "--skip"],
        };
        const secondExpectation: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm run lint", "npm test"],
            forbiddenMatches: ["--skip", "--force"],
        };

        expect(computeRuleSignature(firstTrigger, firstExpectation))
            .toBe(computeRuleSignature(secondTrigger, secondExpectation));
    });

    it("기대 조건 종류가 다르면 다른 규칙 서명을 만든다", () => {
        const trigger: RuleTrigger = { phrases: ["테스트"] };
        const command: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm test"],
        };
        const pattern: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.pattern,
            pattern: "npm test",
        };

        expect(computeRuleSignature(trigger, command)).not.toBe(computeRuleSignature(trigger, pattern));
    });
});
