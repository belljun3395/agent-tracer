import type {
    RuleEnforcementInsertPortDto,
    RuleEnforcementMatchKindPortDto,
    RuleEnforcementReadPort,
    RuleEnforcementRecordPortDto,
    RuleEnforcementWritePort,
} from "../verification/index.js";

export type RuleEnforcementMatchKind = RuleEnforcementMatchKindPortDto;
export type RuleEnforcementRow = RuleEnforcementRecordPortDto;
export type RuleEnforcementInsert = RuleEnforcementInsertPortDto;

export interface IRuleEnforcementRepository extends RuleEnforcementReadPort, RuleEnforcementWritePort {}
