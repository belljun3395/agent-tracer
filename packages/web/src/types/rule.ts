import type { RuleId, TaskId } from "./monitoring.js";

export type RuleScope = "global" | "task";
export type RuleSeverity = "info" | "warn" | "block";
export type RuleSource = "human" | "agent";
export type RuleTriggerSource = "user" | "assistant";
export type VerdictStatus = "verified" | "contradicted" | "unverifiable";
export type RuleEnforcementMatchKind = "trigger" | "expect-fulfilled";

export interface RuleTrigger {
    readonly phrases: readonly string[];
}

export interface RuleExpect {
    readonly tool?: string;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleRecord {
    readonly id: RuleId;
    readonly name: string;
    readonly trigger?: RuleTrigger;
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpect;
    readonly scope: RuleScope;
    readonly taskId?: TaskId;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface VerdictCounts {
    readonly verified: number;
    readonly contradicted: number;
    readonly unverifiable: number;
}

export interface RuleEnforcementOverlay {
    readonly ruleId: RuleId;
    readonly matchKind: RuleEnforcementMatchKind;
}

export interface TaskRulesResponse {
    readonly task: readonly RuleRecord[];
    readonly global: readonly RuleRecord[];
}

export interface RulesListResponse {
    readonly rules: readonly RuleRecord[];
}

export interface RuleCreateInput {
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: {
        readonly tool?: string;
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly scope: RuleScope;
    readonly taskId?: TaskId;
    readonly severity?: RuleSeverity;
    readonly rationale?: string;
}

export interface RuleUpdateInput {
    readonly name?: string;
    readonly trigger?: { readonly phrases: readonly string[] } | null;
    readonly triggerOn?: RuleTriggerSource | null;
    readonly expect?: {
        readonly tool?: string | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: RuleSeverity;
    readonly rationale?: string | null;
}

export interface BackfillResult {
    readonly turnsConsidered: number;
    readonly turnsEvaluated: number;
    readonly verdictsCreated: number;
}
