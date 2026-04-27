import type {RuleScopeUseCaseDto, RuleSourceUseCaseDto, RuleUseCaseDto,} from "./rule.usecase.dto.js";

export type ListRulesScopeUseCaseDto = RuleScopeUseCaseDto;
export type ListRulesSourceUseCaseDto = RuleSourceUseCaseDto;
export type ListRulesRuleUseCaseDto = RuleUseCaseDto;

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
