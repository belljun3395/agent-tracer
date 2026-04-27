/**
 * Public iservice — trigger backfill for a single rule.
 * Consumed by the rule module after create/update/re-evaluate so closed
 * turns get evaluated against the new/changed rule.
 */

export interface VerificationBackfillRule {
    readonly id: string;
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: string;
    readonly expect: {
        readonly action?: string;
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly scope: "global" | "task";
    readonly taskId?: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface VerificationBackfillResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface IVerificationBackfill {
    backfill(rule: VerificationBackfillRule): Promise<VerificationBackfillResult>;
}
