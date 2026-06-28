export interface IVerdictInvalidation {
    deleteVerdictsByRuleId(ruleId: string): Promise<void>;
    deleteEnforcementsByRuleId(ruleId: string): Promise<void>;
}
