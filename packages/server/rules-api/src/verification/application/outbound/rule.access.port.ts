

export type RuleAccessScope = "global" | "task";
export type RuleAccessSeverity = "info" | "warn" | "block";
export type RuleAccessSource = "human" | "agent";
export type RuleAccessTriggerSource = "assistant" | "user";
export type RuleAccessExpectedAction = "command" | "file-read" | "file-write" | "web";

export interface RuleAccessTrigger {
    readonly phrases: readonly string[];
}

export interface RuleAccessExpectation {
    readonly action?: RuleAccessExpectedAction;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleAccessRecord {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleAccessTrigger;
    readonly triggerOn?: RuleAccessTriggerSource;
    readonly expect: RuleAccessExpectation;
    readonly scope: RuleAccessScope;
    readonly taskId?: string;
    readonly source: RuleAccessSource;
    readonly severity: RuleAccessSeverity;
    readonly rationale?: string;
    readonly signature: string;
    readonly createdAt: string;
}

export interface IRuleAccess {
    findActiveForTurn(taskId: string): Promise<readonly RuleAccessRecord[]>;
}
