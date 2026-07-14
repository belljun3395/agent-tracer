import type { RuleDto, RuleExpectation } from "@monitor/kernel";
import type { RuleEntity } from "@monitor/tracer-domain";

export type { RuleDto };

export type RuleExpectationInput = RuleExpectation;

export function mapRule(rule: RuleEntity): RuleDto {
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
        createdAt: rule.createdAt.toISOString(),
    };
}
