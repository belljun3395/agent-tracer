import type { RuleEventMatchKind } from "@monitor/rules-api/domain/verification/event.rule.matching.policy.js";

export type RuleEnforcementMatchKind = RuleEventMatchKind;

export interface RuleEnforcementInsert {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKind;
    readonly decidedAt: string;
}

export interface RuleEnforcementRow {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: RuleEnforcementMatchKind;
    readonly decidedAt: string;
}

export interface IRuleEnforcementRepository {
    findByEventId(eventId: string): Promise<readonly RuleEnforcementRow[]>;
    findByEventIds(eventIds: readonly string[]): Promise<readonly RuleEnforcementRow[]>;
    findByRuleId(ruleId: string): Promise<readonly RuleEnforcementRow[]>;
    eventIdToRuleIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>>;
    insert(row: RuleEnforcementInsert): Promise<RuleEnforcementRow | null>;
    insertMany(rows: readonly RuleEnforcementInsert[]): Promise<readonly RuleEnforcementRow[]>;
    deleteByRuleId(ruleId: string): Promise<void>;
}
