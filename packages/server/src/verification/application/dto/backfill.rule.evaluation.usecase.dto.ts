export type BackfillRuleExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type BackfillRuleScopeUseCaseDto = "global" | "task";
export type BackfillRuleSeverityUseCaseDto = "info" | "warn" | "block";
export type BackfillRuleSourceUseCaseDto = "human" | "agent";
export type BackfillRuleTriggerSourceUseCaseDto = "assistant" | "user";

export interface BackfillRuleTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface BackfillRuleExpectationUseCaseDto {
    readonly action?: BackfillRuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface BackfillRuleEvaluationRuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: BackfillRuleTriggerUseCaseDto;
    readonly triggerOn?: BackfillRuleTriggerSourceUseCaseDto;
    readonly expect: BackfillRuleExpectationUseCaseDto;
    readonly scope: BackfillRuleScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: BackfillRuleSourceUseCaseDto;
    readonly severity: BackfillRuleSeverityUseCaseDto;
    readonly rationale?: string;
    readonly createdAt: string;
}

export interface BackfillRuleEvaluationUseCaseIn {
    readonly rule: BackfillRuleEvaluationRuleUseCaseDto;
}

export interface BackfillRuleEvaluationUseCaseOut {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}
