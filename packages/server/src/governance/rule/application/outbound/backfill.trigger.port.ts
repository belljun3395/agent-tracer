/**
 * Outbound port — trigger a verification backfill for a single rule.
 * The rule module fires this after create / update / re-evaluate so the
 * verification module re-evaluates closed turns against the changed rule.
 *
 * The rule payload is the module's own public Rule contract.
 */
import type { Rule } from "~governance/rule/public/types/rule.types.js";

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
