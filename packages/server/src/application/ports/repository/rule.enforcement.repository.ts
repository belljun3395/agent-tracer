import type { RuleEventMatchKind } from "~domain/verification/index.js";

export type RuleEnforcementMatchKind = RuleEventMatchKind;

export interface RuleEnforcementRow {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKind;
    readonly decidedAt: string;
}

export interface RuleEnforcementInsert {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKind;
    readonly decidedAt: string;
}

export interface IRuleEnforcementRepository {
    insert(row: RuleEnforcementInsert): Promise<RuleEnforcementRow | null>;
    insertMany(rows: readonly RuleEnforcementInsert[]): Promise<readonly RuleEnforcementRow[]>;
    findByEventId(eventId: string): Promise<readonly RuleEnforcementRow[]>;
    findByEventIds(eventIds: readonly string[]): Promise<readonly RuleEnforcementRow[]>;
    deleteByRuleId(ruleId: string): Promise<void>;
    eventIdToRuleIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>>;
}
