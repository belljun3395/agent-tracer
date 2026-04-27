/**
 * Legacy IRuleRepository contract — kept self-contained for the SQLite
 * adapter and remaining legacy consumers (verification BackfillRuleEvaluation).
 * The rule module now wraps this through ~rule/repository/rule.repository.ts.
 */

export type RuleScope = "global" | "task";
export type RuleSeverity = "info" | "warn" | "block";
export type RuleSource = "human" | "agent";
export type RuleTriggerSource = "assistant" | "user";
export type RuleExpectedAction = "command" | "file-read" | "file-write" | "web";

export interface RuleTrigger {
    readonly phrases: readonly string[];
}

export interface RuleExpectation {
    readonly action?: RuleExpectedAction;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleWithSignature {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleTrigger;
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpectation;
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RuleInsertInput {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleTrigger;
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpectation;
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface RuleUpdateInput {
    readonly name?: string;
    readonly trigger?: RuleTrigger | null;
    readonly triggerOn?: RuleTriggerSource | null;
    readonly expect?: {
        readonly action?: RuleExpectedAction | null;
        readonly commandMatches?: readonly string[] | null;
        readonly pattern?: string | null;
    };
    readonly severity?: RuleSeverity;
    readonly rationale?: string | null;
}

export interface ListRulesFilter {
    readonly scope?: RuleScope;
    readonly taskId?: string;
    readonly source?: RuleSource;
}

export interface IRuleRepository {
    findById(id: string): Promise<RuleWithSignature | null>;
    findBySignature(signature: string): Promise<RuleWithSignature | null>;
    findActiveForTurn(taskId: string): Promise<readonly RuleWithSignature[]>;
    list(filter?: ListRulesFilter): Promise<readonly RuleWithSignature[]>;
    insert(input: RuleInsertInput): Promise<RuleWithSignature>;
    update(id: string, patch: RuleUpdateInput, newSignature: string): Promise<RuleWithSignature | null>;
    softDelete(id: string, deletedAt: string): Promise<boolean>;
}
