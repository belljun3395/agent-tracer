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
export type VerdictStatus = "open" | "satisfied" | "unmet" | "unknown";

export type RuleExpect = RuleExpectation;

export interface RuleRecord {
  readonly id: RuleId;
  readonly name: string;
  readonly expect: RuleExpect;
  readonly taskId: TaskId;
  /** 규칙을 낳은 사용자 입력이며 판정 창이 여기서 시작한다. */
  readonly anchorEventId: string;
  /** 서버가 원장과 대조해 남긴, 이 규칙의 의무가 담긴 사용자 턴 식별자다. */
  readonly citedTurnIds: readonly string[];
  /** 서버가 원장과 대조해 남긴, 의무 이행을 보여 주는 이벤트 식별자다. */
  readonly citedEventIds: readonly string[];
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
  /** 아직 판정이 열리지 않았으면 null이다. */
  readonly verdictStatus: VerdictStatus | null;
  /** 상한만큼 알렸는데도 이행되지 않아 사람에게 넘어온 판정이다. */
  readonly escalated: boolean;
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

