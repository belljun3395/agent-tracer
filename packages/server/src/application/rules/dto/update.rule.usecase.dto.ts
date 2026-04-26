export type UpdateRuleExpectedActionUseCaseDto = "command" | "file-read" | "file-write" | "web";
export type UpdateRuleScopeUseCaseDto = "global" | "task";
export type UpdateRuleSeverityUseCaseDto = "info" | "warn" | "block";
export type UpdateRuleSourceUseCaseDto = "human" | "agent";
export type UpdateRuleTriggerSourceUseCaseDto = "assistant" | "user";

export interface UpdateRuleTriggerUseCaseDto {
    readonly phrases: readonly string[];
}

export interface UpdateRuleExpectUseCaseDto {
    readonly tool?: UpdateRuleExpectedActionUseCaseDto;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface UpdateRuleRuleUseCaseDto {
    readonly id: string;
    readonly name: string;
    readonly trigger?: UpdateRuleTriggerUseCaseDto;
    readonly triggerOn?: UpdateRuleTriggerSourceUseCaseDto;
    readonly expect: UpdateRuleExpectUseCaseDto;
    readonly scope: UpdateRuleScopeUseCaseDto;
    readonly taskId?: string;
    readonly source: UpdateRuleSourceUseCaseDto;
    readonly severity: UpdateRuleSeverityUseCaseDto;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

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
