import type {
    RuleExpectationUseCaseDto,
    RuleScopeUseCaseDto,
    RuleSeverityUseCaseDto,
    RuleSourceUseCaseDto,
    RuleTriggerSourceUseCaseDto,
    RuleTriggerUseCaseDto,
    RuleUseCaseDto,
} from "./rule.usecase.dto.js";

export type CreateRuleScopeUseCaseDto = RuleScopeUseCaseDto;
export type CreateRuleSeverityUseCaseDto = RuleSeverityUseCaseDto;
export type CreateRuleSourceUseCaseDto = RuleSourceUseCaseDto;
export type CreateRuleTriggerSourceUseCaseDto = RuleTriggerSourceUseCaseDto;
export type CreateRuleTriggerUseCaseDto = RuleTriggerUseCaseDto;
export type CreateRuleExpectationUseCaseDto = RuleExpectationUseCaseDto;
export type CreateRuleRuleUseCaseDto = RuleUseCaseDto;

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
