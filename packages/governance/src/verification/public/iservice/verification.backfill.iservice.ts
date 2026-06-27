/**
 * Public iservice — trigger backfill for a single rule.
 * Consumed by the rule module after create/update/re-evaluate so closed
 * turns get evaluated against the new/changed rule.
 */
import type { Rule } from "@monitor/governance/rule/public/types/rule.types.js";

export type VerificationBackfillRule = Rule;

export interface VerificationBackfillResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface IVerificationBackfill {
    backfill(rule: VerificationBackfillRule): Promise<VerificationBackfillResult>;
}
