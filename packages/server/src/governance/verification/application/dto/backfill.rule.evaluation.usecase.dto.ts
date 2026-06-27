import type { Rule } from "~governance/rule/public/types/rule.types.js";

export interface BackfillRuleEvaluationUseCaseIn {
    readonly rule: Rule;
}

export interface BackfillRuleEvaluationUseCaseOut {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}
