import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";

export type VerificationBackfillRule = Rule;

export interface VerificationBackfillResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface IVerificationBackfill {
    backfill(rule: VerificationBackfillRule): Promise<VerificationBackfillResult>;
}
