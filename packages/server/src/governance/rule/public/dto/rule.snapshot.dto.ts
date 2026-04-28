/**
 * Self-contained DTO for rule data exposed to other modules.
 * Mirrors the internal Rule shape so consumers don't depend on
 * ~governance/rule/domain internals.
 */

export type RuleSnapshotScope = "global" | "task";
export type RuleSnapshotSeverity = "info" | "warn" | "block";
export type RuleSnapshotSource = "human" | "agent";
export type RuleSnapshotTriggerSource = "assistant" | "user";

export interface RuleSnapshotTrigger {
    readonly phrases: readonly string[];
}

export interface RuleSnapshotExpectation {
    readonly action?: string;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleSnapshot {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleSnapshotTrigger;
    readonly triggerOn?: RuleSnapshotTriggerSource;
    readonly expect: RuleSnapshotExpectation;
    readonly scope: RuleSnapshotScope;
    readonly taskId?: string;
    readonly source: RuleSnapshotSource;
    readonly severity: RuleSnapshotSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RuleSnapshotListFilter {
    readonly scope?: RuleSnapshotScope;
    readonly taskId?: string;
    readonly source?: RuleSnapshotSource;
}

export interface RuleSnapshotInsertInput {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleSnapshotTrigger;
    readonly triggerOn?: RuleSnapshotTriggerSource;
    readonly expect: RuleSnapshotExpectation;
    readonly scope: RuleSnapshotScope;
    readonly taskId?: string;
    readonly source: RuleSnapshotSource;
    readonly severity: RuleSnapshotSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RuleSnapshotUpdateInput {
    readonly name?: string;
    readonly trigger?: RuleSnapshotTrigger | null;
    readonly triggerOn?: RuleSnapshotTriggerSource | null;
    readonly expect?: {
        readonly action?: string | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: RuleSnapshotSeverity;
    readonly rationale?: string | null;
}
