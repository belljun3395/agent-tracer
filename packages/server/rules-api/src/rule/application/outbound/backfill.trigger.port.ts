import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";

export interface BackfillTriggerInput {
    readonly rule: Rule;
}

export interface BackfillTriggerResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface IBackfillTrigger {
    trigger(input: BackfillTriggerInput): Promise<BackfillTriggerResult>;
}
