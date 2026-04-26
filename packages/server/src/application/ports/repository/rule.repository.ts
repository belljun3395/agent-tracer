import type { RuleInsertPortDto } from "~application/ports/rules/dto/rule.insert.port.dto.js";
import type { RuleListFilterPortDto } from "~application/ports/rules/dto/rule.list.filter.port.dto.js";
import type { RuleRecordPortDto } from "~application/ports/rules/dto/rule.record.port.dto.js";
import type { RuleUpdatePortDto } from "~application/ports/rules/dto/rule.update.port.dto.js";
import type { RuleReadPort } from "~application/ports/rules/rule.read.port.js";
import type { RuleSignatureQueryPort } from "~application/ports/rules/rule.signature.query.port.js";
import type { RuleWritePort } from "~application/ports/rules/rule.write.port.js";

export type RuleInsertInput = RuleInsertPortDto;
export type ListRulesFilter = RuleListFilterPortDto;
export type RuleUpdateInput = RuleUpdatePortDto;
export type RuleWithSignature = RuleRecordPortDto;

export interface IRuleRepository extends RuleReadPort, RuleWritePort, RuleSignatureQueryPort {}
