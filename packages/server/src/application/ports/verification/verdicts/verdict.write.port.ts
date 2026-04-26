import type { VerdictInsertPortDto } from "./dto/verdict.insert.port.dto.js";
import type { VerdictRecordPortDto } from "./dto/verdict.record.port.dto.js";

export interface VerdictWritePort {
    insert(input: VerdictInsertPortDto): Promise<VerdictRecordPortDto>;
    deleteByRuleId(ruleId: string): Promise<void>;
    deleteByTurnId(turnId: string): Promise<void>;
}
