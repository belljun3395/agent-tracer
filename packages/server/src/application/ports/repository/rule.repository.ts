import type {
    RuleInsertPortDto,
    RuleListFilterPortDto,
    RuleReadPort,
    RuleRecordPortDto,
    RuleSignatureQueryPort,
    RuleUpdatePortDto,
    RuleWritePort,
} from "../rules/index.js";

export type RuleInsertInput = RuleInsertPortDto;
export type ListRulesFilter = RuleListFilterPortDto;
export type RuleUpdateInput = RuleUpdatePortDto;
export type RuleWithSignature = RuleRecordPortDto;

export interface IRuleRepository extends RuleReadPort, RuleWritePort, RuleSignatureQueryPort {}
