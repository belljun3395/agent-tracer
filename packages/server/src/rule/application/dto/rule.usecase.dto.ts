export type RuleExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type RuleScopeUseCaseDto = "global" | "task";
export type RuleSeverityUseCaseDto = "info" | "warn" | "block";
export type RuleSourceUseCaseDto = "human" | "agent";
export type RuleTriggerSourceUseCaseDto = "assistant" | "user";

export interface RuleTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface RuleExpectationUseCaseDto {
    readonly action?: RuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleExpectUseCaseDto {
    readonly tool?: RuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleTriggerUseCaseDto;
    readonly triggerOn?: RuleTriggerSourceUseCaseDto;
    readonly expect: RuleExpectUseCaseDto;
    readonly scope: RuleScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: RuleSourceUseCaseDto;
    readonly severity: RuleSeverityUseCaseDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}
