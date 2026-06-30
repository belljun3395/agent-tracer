import type { RuleEnforcementMatchKind } from "../outbound/rule.enforcement.repository.port.js";

export interface GetRuleEvidenceForTaskUseCaseIn {
    readonly taskId: string;
    readonly ruleId: string;
}

export type RuleMatchedBy = "action" | "commandMatch" | "pattern" | "trigger-phrase";

export interface RuleEvidenceEventDto {
    readonly eventId: string;
    readonly kind: string;
    readonly title: string;
    readonly body?: string;
    readonly command?: string;
    readonly filePath?: string;
    readonly toolName?: string;
    readonly decidedAt: string;
    readonly createdAt: string;
    readonly matchKind: RuleEnforcementMatchKind;
    readonly matchedBy: readonly RuleMatchedBy[];

    readonly unfulfilled?: boolean;
}

export interface GetRuleEvidenceForTaskUseCaseOut {
    readonly taskId: string;
    readonly ruleId: string;
    readonly triggers: readonly RuleEvidenceEventDto[];
    readonly expects: readonly RuleEvidenceEventDto[];
}
