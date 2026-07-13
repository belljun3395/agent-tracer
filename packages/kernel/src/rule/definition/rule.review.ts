import {
    RULE_SEVERITY,
    RULE_SOURCE,
    type RuleSeverity,
    type RuleSource,
} from "./rule.vocabulary.js";

export const RULE_REVIEW_STATE = {
    active: "active",
    pendingReview: "pendingReview",
} as const;

export const RULE_REVIEW_STATES = [RULE_REVIEW_STATE.active, RULE_REVIEW_STATE.pendingReview] as const;
export type RuleReviewState = (typeof RULE_REVIEW_STATES)[number];

export function admitReviewState(source: RuleSource, severity: RuleSeverity): RuleReviewState {
    return source === RULE_SOURCE.agent && severity === RULE_SEVERITY.block
        ? RULE_REVIEW_STATE.pendingReview
        : RULE_REVIEW_STATE.active;
}

export function isEnforceableReviewState(reviewState: string): boolean {
    return reviewState === RULE_REVIEW_STATE.active;
}
