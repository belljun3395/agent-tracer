import type { RuleEnforcementRecordPortDto } from "./dto/rule.enforcement.record.port.dto.js";

export interface RuleEnforcementReadPort {
    findByEventId(eventId: string): Promise<readonly RuleEnforcementRecordPortDto[]>;
    findByEventIds(eventIds: readonly string[]): Promise<readonly RuleEnforcementRecordPortDto[]>;
    eventIdToRuleIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>>;
}
