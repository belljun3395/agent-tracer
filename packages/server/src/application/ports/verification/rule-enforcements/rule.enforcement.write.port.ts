import type { RuleEnforcementInsertPortDto } from "./dto/rule.enforcement.insert.port.dto.js";
import type { RuleEnforcementRecordPortDto } from "./dto/rule.enforcement.record.port.dto.js";

export interface RuleEnforcementWritePort {
    insert(row: RuleEnforcementInsertPortDto): Promise<RuleEnforcementRecordPortDto | null>;
    insertMany(rows: readonly RuleEnforcementInsertPortDto[]): Promise<readonly RuleEnforcementRecordPortDto[]>;
    deleteByRuleId(ruleId: string): Promise<void>;
}
