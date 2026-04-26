import type { Rule, RuleScope, RuleSource, RuleSeverity, RuleTriggerSource } from "~domain/verification/index.js";

export interface RuleInsertInput {
    readonly id: string;
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: {
        readonly tool?: string;
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly createdAt: string;
}

export interface ListRulesFilter {
    readonly scope?: RuleScope;
    readonly taskId?: string;
    readonly source?: RuleSource;
}

export interface RuleUpdateInput {
    readonly name?: string;
    readonly trigger?: { readonly phrases: readonly string[] } | null; // null = clear trigger
    readonly triggerOn?: RuleTriggerSource | null; // null = clear triggerOn
    readonly expect?: {
        readonly tool?: string | null;             // null = clear
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: "info" | "warn" | "block";
}

export interface IRuleRepository {
    insert(input: RuleInsertInput): Promise<Rule>;
    findById(id: string): Promise<Rule | null>;
    list(filter?: ListRulesFilter): Promise<readonly Rule[]>;
    update(id: string, patch: RuleUpdateInput): Promise<Rule | null>;
    delete(id: string): Promise<boolean>;
    /** Returns rules applicable to a turn: scope=global OR taskId matches. */
    findActiveForTurn(taskId: string): Promise<readonly Rule[]>;
    /** Returns first rule whose deterministic signature matches (used for dedup of agent suggestions). */
    findBySignature(signature: string): Promise<Rule | null>;
}
