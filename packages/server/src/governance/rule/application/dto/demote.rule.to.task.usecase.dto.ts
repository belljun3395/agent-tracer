import type { RuleUseCaseDto } from "./rule.usecase.dto.js";

export type DemoteRuleRuleUseCaseDto = RuleUseCaseDto;

export interface DemoteRuleToTaskUseCaseIn {
    readonly ruleId: string;
    readonly taskId: string;
}

export interface DemoteRuleToTaskUseCaseOut {
    readonly rule: DemoteRuleRuleUseCaseDto;
}
