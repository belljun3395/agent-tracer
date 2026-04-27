/**
 * Outbound port — rule persistence. Self-contained (no external imports).
 * Adapter today wraps the legacy SqliteRuleRepository.
 */

export type RulePersistenceScope = "global" | "task";
export type RulePersistenceSeverity = "info" | "warn" | "block";
export type RulePersistenceSource = "human" | "agent";
export type RulePersistenceTriggerSource = "assistant" | "user";

export interface RulePersistenceTrigger {
    readonly phrases: readonly string[];
}

export type RulePersistenceExpectedAction = "command" | "file-read" | "file-write" | "web";

export interface RulePersistenceExpectation {
    readonly action?: RulePersistenceExpectedAction;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RulePersistenceRecord {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RulePersistenceTrigger;
    readonly triggerOn?: RulePersistenceTriggerSource;
    readonly expect: RulePersistenceExpectation;
    readonly scope: RulePersistenceScope;
    readonly taskId?: string;
    readonly source: RulePersistenceSource;
    readonly severity: RulePersistenceSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RulePersistenceInsertInput {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RulePersistenceTrigger;
    readonly triggerOn?: RulePersistenceTriggerSource;
    readonly expect: RulePersistenceExpectation;
    readonly scope: RulePersistenceScope;
    readonly taskId?: string;
    readonly source: RulePersistenceSource;
    readonly severity: RulePersistenceSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RulePersistenceUpdateInput {
    readonly name?: string;
    readonly trigger?: RulePersistenceTrigger | null;
    readonly triggerOn?: RulePersistenceTriggerSource | null;
    readonly expect?: {
        readonly action?: string | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: RulePersistenceSeverity;
    readonly rationale?: string | null;
}

export interface RulePersistenceListFilter {
    readonly scope?: RulePersistenceScope;
    readonly taskId?: string;
    readonly source?: RulePersistenceSource;
}

export interface IRulePersistence {
    findById(id: string): Promise<RulePersistenceRecord | null>;
    findBySignature(signature: string): Promise<RulePersistenceRecord | null>;
    findActiveForTurn(taskId: string): Promise<readonly RulePersistenceRecord[]>;
    list(filter?: RulePersistenceListFilter): Promise<readonly RulePersistenceRecord[]>;
    insert(input: RulePersistenceInsertInput): Promise<RulePersistenceRecord>;
    update(id: string, patch: RulePersistenceUpdateInput, newSignature: string): Promise<RulePersistenceRecord | null>;
    softDelete(id: string, deletedAt: string): Promise<boolean>;
}
