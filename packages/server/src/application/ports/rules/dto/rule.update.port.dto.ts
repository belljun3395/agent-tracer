import type { RuleExpectedAction, RuleSeverity, RuleTriggerSource } from "~domain/verification/rule/type/rule.value.type.js";

export interface RuleUpdatePortDto {
    readonly name?: string;
    readonly trigger?: { readonly phrases: readonly string[] } | null;
    readonly triggerOn?: RuleTriggerSource | null;
    readonly expect?: {
        readonly action?: RuleExpectedAction | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: RuleSeverity;
    readonly rationale?: string | null;
}
