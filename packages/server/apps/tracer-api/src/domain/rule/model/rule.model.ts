import type { RuleDto, RuleExpectation } from "@monitor/kernel";
import type { RuleEntity, VerdictEntity } from "@monitor/tracer-domain";

export type { RuleDto };

export type RuleExpectationInput = RuleExpectation;

export function mapRule(rule: RuleEntity): RuleDto {
    return mapRuleWithVerdict(rule, null);
}

export function mapRuleWithVerdict(rule: RuleEntity, verdict: VerdictEntity | null): RuleDto {
    return {
        id: rule.id,
        userId: rule.userId,
        name: rule.name,
        expectation: rule.expectation,
        taskId: rule.taskId,
        source: rule.source,
        severity: rule.severity,
        rationale: rule.rationale,
        signature: rule.signature,
        userEdited: rule.userEdited,
        reviewState: rule.reviewState,
        lastEditedBy: rule.lastEditedBy,
        rev: rule.rev,
        sourceJobId: rule.sourceJobId,
        anchorEventId: rule.anchorEventId,
        citedTurnIds: rule.citedTurnIds,
        citedEventIds: rule.citedEventIds,
        createdAt: rule.createdAt.toISOString(),
        verdictStatus: verdict?.status ?? null,
        nudgeCount: verdict?.nudgeCount ?? 0,
        escalated: verdict?.isEscalated() ?? false,
        ...(verdict !== null
            ? { matchCount: new Set(verdict.evidence.enforcements.map((record) => record.eventId)).size }
            : {}),
    };
}
