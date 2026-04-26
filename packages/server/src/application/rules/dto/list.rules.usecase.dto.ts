export type ListRulesExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type ListRulesScopeUseCaseDto = "global" | "task";
export type ListRulesSeverityUseCaseDto = "info" | "warn" | "block";
export type ListRulesSourceUseCaseDto = "human" | "agent";
export type ListRulesTriggerSourceUseCaseDto = "assistant" | "user";

export interface ListRulesTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface ListRulesExpectUseCaseDto {
    readonly tool?: ListRulesExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface ListRulesRuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: ListRulesTriggerUseCaseDto;
    readonly triggerOn?: ListRulesTriggerSourceUseCaseDto;
    readonly expect: ListRulesExpectUseCaseDto;
    readonly scope: ListRulesScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: ListRulesSourceUseCaseDto;
    readonly severity: ListRulesSeverityUseCaseDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface ListRulesUseCaseIn {
    readonly scope?: ListRulesScopeUseCaseDto;
    readonly taskId?: string;
    readonly source?: ListRulesSourceUseCaseDto;
}

export interface ListRulesUseCaseOut {
    readonly rules: readonly ListRulesRuleUseCaseDto[];
}

export interface ListRulesForTaskUseCaseIn {
    readonly taskId: string;
}

export interface ListRulesForTaskUseCaseOut {
    readonly task: readonly ListRulesRuleUseCaseDto[];
    readonly global: readonly ListRulesRuleUseCaseDto[];
}
