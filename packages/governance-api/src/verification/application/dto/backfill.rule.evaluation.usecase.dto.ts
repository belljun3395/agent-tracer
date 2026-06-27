import type { Rule } from "@monitor/governance-api/rule/public/types/rule.types.js";

export interface BackfillRuleEvaluationUseCaseIn {
    readonly rule: Rule;
}

export interface BackfillRuleEvaluationUseCaseOut {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}
