export type PromoteRuleExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type PromoteRuleScopeUseCaseDto = "global" | "task";
export type PromoteRuleSeverityUseCaseDto = "info" | "warn" | "block";
export type PromoteRuleSourceUseCaseDto = "human" | "agent";
export type PromoteRuleTriggerSourceUseCaseDto = "assistant" | "user";

export interface PromoteRuleTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface PromoteRuleExpectUseCaseDto {
    readonly tool?: PromoteRuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface PromoteRuleRuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: PromoteRuleTriggerUseCaseDto;
    readonly triggerOn?: PromoteRuleTriggerSourceUseCaseDto;
    readonly expect: PromoteRuleExpectUseCaseDto;
    readonly scope: PromoteRuleScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: PromoteRuleSourceUseCaseDto;
    readonly severity: PromoteRuleSeverityUseCaseDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface PromoteRuleToGlobalUseCaseIn {
    readonly ruleId: string;
}

export interface PromoteRuleToGlobalUseCaseOut {
    readonly rule: PromoteRuleRuleUseCaseDto;
}
