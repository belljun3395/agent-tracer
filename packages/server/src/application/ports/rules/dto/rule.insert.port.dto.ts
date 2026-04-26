import type { RuleExpectedAction, RuleScope, RuleSeverity, RuleSource, RuleTriggerSource } from "~domain/verification/rule/type/rule.value.type.js";

export interface RuleInsertPortDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: {
        readonly action?: RuleExpectedAction;
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}
