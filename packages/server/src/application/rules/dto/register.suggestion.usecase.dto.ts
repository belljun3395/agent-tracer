export type RegisterSuggestionExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type RegisterSuggestionScopeUseCaseDto = "global" | "task";
export type RegisterSuggestionSeverityUseCaseDto = "info" | "warn" | "block";
export type RegisterSuggestionSourceUseCaseDto = "human" | "agent";
export type RegisterSuggestionTriggerSourceUseCaseDto = "assistant" | "user";

export interface RegisterSuggestionTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface RegisterSuggestionExpectationUseCaseDto {
    readonly action?: RegisterSuggestionExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RegisterSuggestionExpectUseCaseDto {
    readonly tool?: RegisterSuggestionExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RegisterSuggestionRuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RegisterSuggestionTriggerUseCaseDto;
    readonly triggerOn?: RegisterSuggestionTriggerSourceUseCaseDto;
    readonly expect: RegisterSuggestionExpectUseCaseDto;
    readonly scope: RegisterSuggestionScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: RegisterSuggestionSourceUseCaseDto;
    readonly severity: RegisterSuggestionSeverityUseCaseDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RegisterSuggestionUseCaseIn {
    readonly name: string;
    readonly trigger?: RegisterSuggestionTriggerUseCaseDto;
    readonly triggerOn?: RegisterSuggestionTriggerSourceUseCaseDto;
    readonly expect: RegisterSuggestionExpectationUseCaseDto;
    readonly scope: RegisterSuggestionScopeUseCaseDto;
    readonly taskId?: string;
    readonly severity?: RegisterSuggestionSeverityUseCaseDto;
    readonly rationale?: string;
}

export interface RegisterSuggestionUseCaseOut {
    readonly rule: RegisterSuggestionRuleUseCaseDto;
    readonly created: boolean;
}
