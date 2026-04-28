import type {RuleUseCaseDto,} from "./rule.usecase.dto.js";

export type PromoteRuleRuleUseCaseDto = RuleUseCaseDto;

export interface PromoteRuleToGlobalUseCaseIn {
    readonly ruleId: string;
}

export interface PromoteRuleToGlobalUseCaseOut {
    readonly rule: PromoteRuleRuleUseCaseDto;
}
