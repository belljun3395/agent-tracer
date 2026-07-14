/** 서버가 규칙 제안을 수용하지 않은 이유 계약이다. */
export const RULE_PROPOSAL_DISCARD_REASON = {
    duplicate: "duplicate",
    noTask: "no-task",
    noAnchor: "no-anchor",
} as const;

export const RULE_PROPOSAL_DISCARD_REASONS = [
    RULE_PROPOSAL_DISCARD_REASON.duplicate,
    RULE_PROPOSAL_DISCARD_REASON.noTask,
    RULE_PROPOSAL_DISCARD_REASON.noAnchor,
] as const;

export type RuleProposalDiscardReason = (typeof RULE_PROPOSAL_DISCARD_REASONS)[number];

export interface DiscardedRuleProposal {
    readonly name: string;
    readonly reason: RuleProposalDiscardReason;
}
