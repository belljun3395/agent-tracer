import type { RuleExpectedAction } from "../type/rule.value.type.js";

export interface RuleTrigger {
    readonly phrases: readonly string[];
}

export interface RuleExpectation {
    readonly action?: RuleExpectedAction;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}
