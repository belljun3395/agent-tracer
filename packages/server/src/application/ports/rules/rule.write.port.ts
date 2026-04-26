import type { RuleInsertPortDto } from "./dto/rule.insert.port.dto.js";
import type { RuleRecordPortDto } from "./dto/rule.record.port.dto.js";
import type { RuleUpdatePortDto } from "./dto/rule.update.port.dto.js";

export interface RuleWritePort {
    insert(input: RuleInsertPortDto): Promise<RuleRecordPortDto>;
    update(id: string, patch: RuleUpdatePortDto, newSignature: string): Promise<RuleRecordPortDto | null>;
    softDelete(id: string, deletedAt: string): Promise<boolean>;
}
