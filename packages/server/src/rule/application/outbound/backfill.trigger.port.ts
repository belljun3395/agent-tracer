/**
 * Outbound port — trigger a verification backfill for a single rule.
 * The rule module fires this after create / update / re-evaluate so the
 * verification module re-evaluates closed turns against the changed rule.
 *
 * Self-contained — adapter wraps verification.public IVerificationBackfill.
 */

export interface BackfillTriggerInput {
    readonly rule: {
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
    };
}

export interface BackfillTriggerResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}

export interface IBackfillTrigger {
    trigger(input: BackfillTriggerInput): Promise<BackfillTriggerResult>;
}
