import type { RuleExpectedAction } from "./rule.value.type.js";

export interface RuleExpectInput {
    readonly action?: RuleExpectedAction | undefined;
    readonly commandMatches?: readonly string[] | undefined;
    readonly pattern?: string | undefined;
}
