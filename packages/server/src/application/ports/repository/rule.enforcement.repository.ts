import type { RuleEnforcementInsertPortDto } from "~application/ports/verification/rule-enforcements/dto/rule.enforcement.insert.port.dto.js";
import type { RuleEnforcementMatchKindPortDto, RuleEnforcementRecordPortDto } from "~application/ports/verification/rule-enforcements/dto/rule.enforcement.record.port.dto.js";
import type { RuleEnforcementReadPort } from "~application/ports/verification/rule-enforcements/rule.enforcement.read.port.js";
import type { RuleEnforcementWritePort } from "~application/ports/verification/rule-enforcements/rule.enforcement.write.port.js";

export type RuleEnforcementMatchKind = RuleEnforcementMatchKindPortDto;
export type RuleEnforcementRow = RuleEnforcementRecordPortDto;
export type RuleEnforcementInsert = RuleEnforcementInsertPortDto;

export interface IRuleEnforcementRepository extends RuleEnforcementReadPort, RuleEnforcementWritePort {}
