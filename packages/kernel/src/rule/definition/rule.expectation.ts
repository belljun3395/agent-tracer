import {
    RULE_EXPECTATION_KIND,
    type RuleExpectation,
    type RuleExpectedAction,
} from "./rule.vocabulary.js";

/** 기대 조건이 특정 도구군을 요구하면 그 도구군을 반환한다. */
export function expectationTool(expectation: RuleExpectation): RuleExpectedAction | undefined {
    switch (expectation.kind) {
        case RULE_EXPECTATION_KIND.pattern:
        case RULE_EXPECTATION_KIND.action:
            return expectation.tool;
        default:
            return undefined;
    }
}
