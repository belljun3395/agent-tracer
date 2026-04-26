import type { RuleEnforcementMatchKindPortDto } from "./rule.enforcement.record.port.dto.js";

export interface RuleEnforcementInsertPortDto {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKindPortDto;
    readonly decidedAt: string;
}
