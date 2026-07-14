import type { RuleDto } from "@monitor/kernel";
import type { RuleId, TaskId } from "~web/shared/identity.js";
import type {
  RuleRecord,
  RuleSeverity,
  RuleSource,
} from "~web/entities/rule/model/rule.js";

export function toRuleRecord(rule: RuleDto): RuleRecord {
  return {
    id: rule.id as RuleId,
    name: rule.name,
    expect: rule.expectation,
    taskId: rule.taskId as TaskId,
    anchorEventId: rule.anchorEventId,
    source: rule.source as RuleSource,
    severity: rule.severity as RuleSeverity,
    ...(rule.rationale ? { rationale: rule.rationale } : {}),
    signature: rule.signature,
    userEdited: rule.userEdited,
    reviewState: rule.reviewState,
    lastEditedBy: rule.lastEditedBy as RuleSource,
    rev: rule.rev,
    ...(rule.sourceJobId !== null ? { sourceJobId: rule.sourceJobId } : {}),
    createdAt: rule.createdAt,
    verdictStatus: rule.verdictStatus,
    escalated: rule.escalated,
    ...(rule.matchCount !== undefined ? { matchCount: rule.matchCount } : {}),
  };
}
