

export interface IVerificationInvalidation {
    deleteVerdictsByRuleId(ruleId: string): Promise<void>;
    deleteEnforcementsByRuleId(ruleId: string): Promise<void>;
}
