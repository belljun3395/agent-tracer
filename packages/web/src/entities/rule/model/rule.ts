import type {
  RuleExpectation,
  RuleExpectationKind,
  RuleExpectedAction,
} from "@monitor/kernel";
import { RULE_EXPECTATION_KIND, RULE_EXPECTATION_KINDS } from "@monitor/kernel";
import type { RuleId, TaskId } from "~web/shared/identity.js";

export type RuleSeverity = "info" | "warn" | "block";
export type RuleSource = "human" | "agent";
export type { RuleExpectation, RuleExpectationKind, RuleExpectedAction };
export { RULE_EXPECTATION_KIND, RULE_EXPECTATION_KINDS };
export type VerdictStatus = "verified" | "contradicted" | "unverifiable";

export type RuleExpect = RuleExpectation;

export interface RuleRecord {
  readonly id: RuleId;
  readonly name: string;
  readonly expect: RuleExpect;
  readonly taskId: TaskId;
  /** 규칙을 낳은 사용자 입력이며 판정 창이 여기서 시작한다. */
  readonly anchorEventId: string;
  readonly source: RuleSource;
  readonly severity: RuleSeverity;
  readonly rationale?: string;
  readonly signature: string;
  readonly userEdited: boolean;
  readonly reviewState: RuleReviewState;
  readonly lastEditedBy: RuleSource;
  readonly rev: number;
  readonly sourceJobId?: string;
  readonly createdAt: string;
  readonly matchCount?: number;
}

export interface RulesListResponse {
  readonly rules: readonly RuleRecord[];
}

export interface RuleCreateInput {
  readonly name: string;
  readonly expect: RuleExpect;
  readonly taskId: TaskId;
  readonly anchorEventId: string;
  readonly severity?: RuleSeverity;
  readonly rationale?: string;
}

export interface RuleUpdateInput {
  readonly name?: string;
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

/** 규칙은 하나의 사용자 발화에서 나오므로 그 발화별로 묶어 보여준다. */
export function groupRulesByAnchor(rules: readonly RuleRecord[]): readonly (readonly RuleRecord[])[] {
  const groups = new Map<string, RuleRecord[]>();
  for (const rule of rules) {
    const bucket = groups.get(rule.anchorEventId);
    if (bucket === undefined) groups.set(rule.anchorEventId, [rule]);
    else bucket.push(rule);
  }
  return [...groups.values()];
}
