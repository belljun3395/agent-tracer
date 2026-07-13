import type {
  RuleExpectation,
  RuleExpectationKind,
  RuleExpectedAction,
} from "@monitor/kernel";
import { RULE_EXPECTATION_KIND, RULE_EXPECTATION_KINDS } from "@monitor/kernel";
import type { RuleId, TaskId } from "~web/shared/identity.js";

export type RuleScope = "global" | "task";
export type RuleSeverity = "info" | "warn" | "block";
export type RuleSource = "human" | "agent";
export type RuleTriggerSource = "user" | "assistant";
export type { RuleExpectation, RuleExpectationKind, RuleExpectedAction };
export { RULE_EXPECTATION_KIND, RULE_EXPECTATION_KINDS };
export type VerdictStatus = "verified" | "contradicted" | "unverifiable";

export interface RuleTrigger {
  readonly phrases: readonly string[];
}

export type RuleExpect = RuleExpectation;

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
  readonly userEdited: boolean;
  readonly reviewState: RuleReviewState;
  readonly lastEditedBy: RuleSource;
  readonly rev: number;
  readonly sourceJobId?: string;
  readonly anchorEventId?: string;
  readonly createdAt: string;
  readonly matchCount?: number;
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
  readonly expect: RuleExpect;
  readonly scope: RuleScope;
  readonly taskId?: TaskId;
  readonly severity?: RuleSeverity;
  readonly rationale?: string;
}

export interface RuleUpdateInput {
  readonly name?: string;
  readonly trigger?: { readonly phrases: readonly string[] } | null;
  readonly triggerOn?: RuleTriggerSource | null;
  readonly expect?: RuleExpect;
  readonly severity?: RuleSeverity;
  readonly rationale?: string | null;
}

export const RULE_REVIEW_STATE = {
  active: "active",
  pendingReview: "pendingReview",
} as const;

export type RuleReviewState = (typeof RULE_REVIEW_STATE)[keyof typeof RULE_REVIEW_STATE];

export function needsReview(rule: RuleRecord): boolean {
  return rule.reviewState === RULE_REVIEW_STATE.pendingReview;
}

export function partitionRulesByScope(rules: readonly RuleRecord[]): TaskRulesResponse {
  return {
    task: rules.filter((rule) => rule.scope === "task"),
    global: rules.filter((rule) => rule.scope === "global"),
  };
}
