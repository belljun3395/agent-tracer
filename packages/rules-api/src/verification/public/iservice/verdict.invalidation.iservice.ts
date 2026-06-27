/**
 * Public iservice — clear verdicts/enforcements for a rule whose matching
 * shape changed. Consumed by the rule module's update flow.
 */
export interface IVerdictInvalidation {
    deleteVerdictsByRuleId(ruleId: string): Promise<void>;
    deleteEnforcementsByRuleId(ruleId: string): Promise<void>;
}
