import type { RuleEventMatchKind } from "~governance/verification/domain/event-rule.matching.js";

/**
 * Legacy IRuleEnforcementRepository contract — self-contained for the SQLite
 * adapter and verification module factory bindings.
 */

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
    eventIdToRuleIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>>;
    insert(row: RuleEnforcementInsert): Promise<RuleEnforcementRow | null>;
    insertMany(rows: readonly RuleEnforcementInsert[]): Promise<readonly RuleEnforcementRow[]>;
    deleteByRuleId(ruleId: string): Promise<void>;
}
