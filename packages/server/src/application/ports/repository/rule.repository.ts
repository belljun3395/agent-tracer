import type {
    Rule,
    RuleExpectedAction,
    RuleScope,
    RuleSource,
    RuleSeverity,
    RuleTriggerSource,
} from "~domain/verification/index.js";

export interface RuleInsertInput {
    readonly id: string;
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: {
        readonly action?: RuleExpectedAction;
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly signature: string;
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
        readonly action?: RuleExpectedAction | null; // null = clear
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: "info" | "warn" | "block";
    readonly rationale?: string | null;
}

export interface RuleWithSignature extends Rule {
    readonly signature: string;
}

export interface IRuleRepository {
    insert(input: RuleInsertInput): Promise<RuleWithSignature>;
    findById(id: string): Promise<RuleWithSignature | null>;
    list(filter?: ListRulesFilter): Promise<readonly RuleWithSignature[]>;
    update(id: string, patch: RuleUpdateInput, newSignature: string): Promise<RuleWithSignature | null>;
    softDelete(id: string, deletedAt: string): Promise<boolean>;
    findActiveForTurn(taskId: string): Promise<readonly RuleWithSignature[]>;
    findBySignature(signature: string): Promise<RuleWithSignature | null>;
}
