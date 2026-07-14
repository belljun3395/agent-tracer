import { inferToolCall, type RuleEvaluationEvent } from "./rule.evaluation.context.js";
import { compilePattern } from "./rule.pattern.js";
import { normalizeRuleExpectedAction } from "./rule.tool-alias.const.js";
import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
} from "../definition/rule.vocabulary.js";

const MAX_PATTERN_TARGET_LEN = 4096;

/** 이벤트 하나가 기대 이행 증거인지 판정한다. */
export function expectFulfilledBy(exp: RuleExpectation, event: RuleEvaluationEvent): boolean {
    const tc = inferToolCall(event);
    if (tc === null) return false;
    switch (exp.kind) {
        case RULE_EXPECTATION_KIND.action:
            return normalizeRuleExpectedAction(tc.tool) === exp.tool;
        case RULE_EXPECTATION_KIND.command: {
            const cmd = (tc.command ?? "").toLowerCase();
            return cmd.length > 0 && exp.commandMatches.some((match) => cmd.includes(match.toLowerCase()));
        }
        case RULE_EXPECTATION_KIND.pattern: {
            if (exp.tool !== undefined && normalizeRuleExpectedAction(tc.tool) !== exp.tool) return false;
            const pattern = compilePattern(exp.pattern);
            if (pattern === null) return false;
            const target = (tc.filePath ?? tc.command ?? tc.target ?? "").slice(0, MAX_PATTERN_TARGET_LEN);
            return pattern.test(target);
        }
    }
}
