import type {
    RULE_EXPECTED_ACTIONS,
    RULE_SCOPES,
    RULE_SEVERITIES,
    RULE_SOURCES,
    RULE_TRIGGER_SOURCES,
} from "../const/rule.const.js";

export type RuleSeverity = (typeof RULE_SEVERITIES)[number];
export type RuleScope = (typeof RULE_SCOPES)[number];
export type RuleSource = (typeof RULE_SOURCES)[number];
export type RuleTriggerSource = (typeof RULE_TRIGGER_SOURCES)[number];
export type RuleExpectedAction = (typeof RULE_EXPECTED_ACTIONS)[number];
