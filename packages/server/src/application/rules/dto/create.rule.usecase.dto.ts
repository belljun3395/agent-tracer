export type CreateRuleExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type CreateRuleScopeUseCaseDto = "global" | "task";
export type CreateRuleSeverityUseCaseDto = "info" | "warn" | "block";
export type CreateRuleSourceUseCaseDto = "human" | "agent";
export type CreateRuleTriggerSourceUseCaseDto = "assistant" | "user";

export interface CreateRuleTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface CreateRuleExpectationUseCaseDto {
    readonly action?: CreateRuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface CreateRuleExpectUseCaseDto {
    readonly tool?: CreateRuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface CreateRuleRuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: CreateRuleTriggerUseCaseDto;
    readonly triggerOn?: CreateRuleTriggerSourceUseCaseDto;
    readonly expect: CreateRuleExpectUseCaseDto;
    readonly scope: CreateRuleScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: CreateRuleSourceUseCaseDto;
    readonly severity: CreateRuleSeverityUseCaseDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface CreateRuleUseCaseIn {
    readonly name: string;
    readonly trigger?: CreateRuleTriggerUseCaseDto;
    readonly triggerOn?: CreateRuleTriggerSourceUseCaseDto;
    readonly expect: CreateRuleExpectationUseCaseDto;
    readonly scope: CreateRuleScopeUseCaseDto;
    readonly taskId?: string;
    readonly source?: CreateRuleSourceUseCaseDto;
    readonly severity?: CreateRuleSeverityUseCaseDto;
    readonly rationale?: string;
}

export interface CreateRuleUseCaseOut {
    readonly rule: CreateRuleRuleUseCaseDto;
}
