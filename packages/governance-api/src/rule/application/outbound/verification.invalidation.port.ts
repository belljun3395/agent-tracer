/**
 * Outbound port — verification side-effects triggered when a rule's matching
 * shape changes (verdicts + enforcements need to be cleared so backfill can
 * re-evaluate). Self-contained.
 *
 * Adapter today: wraps legacy IVerdictRepository + IRuleEnforcementRepository
 * directly. Will switch to verification.public iservices when verification
 * module exposes them.
 */

export interface IVerificationInvalidation {
    deleteVerdictsByRuleId(ruleId: string): Promise<void>;
    deleteEnforcementsByRuleId(ruleId: string): Promise<void>;
}
