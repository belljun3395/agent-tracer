import type {
    RuleExpectationUseCaseDto,
    RuleScopeUseCaseDto,
    RuleSeverityUseCaseDto,
    RuleTriggerSourceUseCaseDto,
    RuleTriggerUseCaseDto,
    RuleUseCaseDto,
} from "./rule.usecase.dto.js";

export type RegisterSuggestionScopeUseCaseDto = RuleScopeUseCaseDto;
export type RegisterSuggestionSeverityUseCaseDto = RuleSeverityUseCaseDto;
export type RegisterSuggestionTriggerSourceUseCaseDto = RuleTriggerSourceUseCaseDto;
export type RegisterSuggestionTriggerUseCaseDto = RuleTriggerUseCaseDto;
export type RegisterSuggestionExpectationUseCaseDto = RuleExpectationUseCaseDto;
export type RegisterSuggestionRuleUseCaseDto = RuleUseCaseDto;

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
