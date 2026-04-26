import type { RuleListFilterPortDto } from "./dto/rule.list.filter.port.dto.js";
import type { RuleRecordPortDto } from "./dto/rule.record.port.dto.js";

export interface RuleReadPort {
    findById(id: string): Promise<RuleRecordPortDto | null>;
    list(filter?: RuleListFilterPortDto): Promise<readonly RuleRecordPortDto[]>;
    findActiveForTurn(taskId: string): Promise<readonly RuleRecordPortDto[]>;
}
