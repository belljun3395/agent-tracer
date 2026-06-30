import type { Rule } from "@monitor/rules-api/domain/rule/rule.types.js";

export interface BackfillRuleEvaluationUseCaseIn {
    readonly rule: Rule;
}

export interface BackfillRuleEvaluationUseCaseOut {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}
