import { expectationTool } from "./rule.expectation.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
} from "./rule.vocabulary.js";

/** 규칙 기대의 순서 차이를 제거한 중복 판정 서명이다. */
export function computeRuleSignature(expectation: RuleExpectation): string {
    return JSON.stringify({
        kind: expectation.kind,
        tool: expectationTool(expectation) ?? null,
        commandMatches: expectation.kind === RULE_EXPECTATION_KIND.command
            ? [...expectation.commandMatches].sort()
            : null,
        pattern: expectation.kind === RULE_EXPECTATION_KIND.pattern ? expectation.pattern : null,
    });
}
