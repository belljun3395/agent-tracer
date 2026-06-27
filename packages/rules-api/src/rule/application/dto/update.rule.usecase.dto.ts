import type {
    RuleExpectedActionUseCaseDto,
    RuleSeverityUseCaseDto,
    RuleTriggerSourceUseCaseDto,
    RuleTriggerUseCaseDto,
    RuleUseCaseDto,
} from "./rule.usecase.dto.js";

export type UpdateRuleExpectedActionUseCaseDto = RuleExpectedActionUseCaseDto;
export type UpdateRuleSeverityUseCaseDto = RuleSeverityUseCaseDto;
export type UpdateRuleTriggerSourceUseCaseDto = RuleTriggerSourceUseCaseDto;
export type UpdateRuleTriggerUseCaseDto = RuleTriggerUseCaseDto;
export type UpdateRuleRuleUseCaseDto = RuleUseCaseDto;

export interface UpdateRuleUseCaseIn {
    readonly id: string;
    readonly name?: string;
    readonly trigger?: UpdateRuleTriggerUseCaseDto | null;
    readonly triggerOn?: UpdateRuleTriggerSourceUseCaseDto | null;
    readonly expect?: {
        readonly action?: UpdateRuleExpectedActionUseCaseDto | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: UpdateRuleSeverityUseCaseDto;
    readonly rationale?: string | null;
}

export interface UpdateRuleUseCaseOut {
    readonly rule: UpdateRuleRuleUseCaseDto;
    readonly signatureChanged: boolean;
}
