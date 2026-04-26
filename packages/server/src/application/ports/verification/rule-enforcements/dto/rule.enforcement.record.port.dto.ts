import type { RuleEventMatchKind } from "~domain/verification/index.js";

export type RuleEnforcementMatchKindPortDto = RuleEventMatchKind;

export interface RuleEnforcementRecordPortDto {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKindPortDto;
    readonly decidedAt: string;
}
