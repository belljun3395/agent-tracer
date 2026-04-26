import type { RuleEventMatchKind } from "~domain/verification/rule/event-rule.matching.js";

export type RuleEnforcementMatchKindPortDto = RuleEventMatchKind;

export interface RuleEnforcementRecordPortDto {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKindPortDto;
    readonly decidedAt: string;
}
