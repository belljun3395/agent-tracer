import { describe, expect, it } from "vitest";
import { computeRuleSignature } from "./rule.signature.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
} from "./rule.vocabulary.js";

describe("computeRuleSignature", () => {
    it("기대 명령 목록의 순서가 달라도 같은 규칙 서명을 만든다", () => {
        const first: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm test", "npm run lint"],
        };
        const second: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm run lint", "npm test"],
        };

        expect(computeRuleSignature(first)).toBe(computeRuleSignature(second));
    });

    it("기대 조건 종류가 다르면 다른 규칙 서명을 만든다", () => {
        const command: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm test"],
        };
        const pattern: RuleExpectation = {
            kind: RULE_EXPECTATION_KIND.pattern,
            pattern: "npm test",
        };

        expect(computeRuleSignature(command)).not.toBe(computeRuleSignature(pattern));
    });

    it("같은 종류라도 기대 도구가 다르면 다른 규칙 서명을 만든다", () => {
        const read: RuleExpectation = { kind: RULE_EXPECTATION_KIND.action, tool: "file-read" };
        const write: RuleExpectation = { kind: RULE_EXPECTATION_KIND.action, tool: "file-write" };

        expect(computeRuleSignature(read)).not.toBe(computeRuleSignature(write));
    });
});
