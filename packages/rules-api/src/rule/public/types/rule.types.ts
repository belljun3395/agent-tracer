/**
 * Public rule type surface — re-exports from rule's domain so cross-module
 * consumers (e.g. verification) don't reach into @monitor/rules-api/rule/domain/. These are
 * pure interfaces / string-union types with no behavior.
 */
export type {
    RuleScope,
    RuleSeverity,
    RuleSource,
    RuleTriggerSource,
    RuleExpectedAction,
} from "@monitor/rules-api/rule/domain/type/rule.value.type.js";

export type {
    RuleTrigger,
    RuleExpectation,
} from "@monitor/rules-api/rule/domain/model/rule.expectation.model.js";

export type { Rule } from "@monitor/rules-api/rule/domain/model/rule.model.js";
