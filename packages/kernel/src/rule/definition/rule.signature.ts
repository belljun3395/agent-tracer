import { expectationTool } from "./rule.expectation.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
    type RuleTrigger,
} from "./rule.vocabulary.js";

/** 규칙 정의의 순서 차이를 제거한 중복 판정 서명이다. */
export function computeRuleSignature(trigger: RuleTrigger, expectation: RuleExpectation): string {
    const forbiddenMatches = expectation.forbiddenMatches !== undefined && expectation.forbiddenMatches.length > 0
        ? [...expectation.forbiddenMatches].sort()
        : null;
    return JSON.stringify({
        phrases: trigger.phrases.length > 0 ? [...trigger.phrases].sort() : null,
        on: trigger.on ?? null,
        kind: expectation.kind,
        tool: expectationTool(expectation) ?? null,
        commandMatches: expectation.kind === RULE_EXPECTATION_KIND.command
            ? [...expectation.commandMatches].sort()
            : null,
        pattern: expectation.kind === RULE_EXPECTATION_KIND.pattern ? expectation.pattern : null,
        ...(forbiddenMatches !== null ? { forbiddenMatches } : {}),
    });
}
