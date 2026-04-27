import type { RuleExpectation, RuleTrigger } from "./rule.expectation.model.js";
import type {
    RuleScope,
    RuleSeverity,
    RuleSource,
    RuleTriggerSource,
} from "../type/rule.value.type.js";

export interface Rule {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleTrigger;
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpectation;
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly createdAt: string;
}
