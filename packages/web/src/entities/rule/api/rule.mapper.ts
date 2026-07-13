import type { RuleDto } from "@monitor/kernel";
import type { RuleId, TaskId } from "~web/shared/identity.js";
import type {
  RuleRecord,
  RuleScope,
  RuleSeverity,
  RuleSource,
} from "~web/entities/rule/model/rule.js";

export function toRuleRecord(rule: RuleDto): RuleRecord {
  return {
    id: rule.id as RuleId,
    name: rule.name,
    ...(rule.trigger.phrases.length > 0 ? { trigger: { phrases: rule.trigger.phrases } } : {}),
    ...(rule.trigger.on ? { triggerOn: rule.trigger.on } : {}),
    expect: rule.expectation,
    scope: rule.scope as RuleScope,
    ...(rule.taskId ? { taskId: rule.taskId as TaskId } : {}),
    source: rule.source as RuleSource,
    severity: rule.severity as RuleSeverity,
    ...(rule.rationale ? { rationale: rule.rationale } : {}),
    signature: rule.signature,
    userEdited: rule.userEdited,
    reviewState: rule.reviewState,
    lastEditedBy: rule.lastEditedBy as RuleSource,
    rev: rule.rev,
    ...(rule.sourceJobId !== null ? { sourceJobId: rule.sourceJobId } : {}),
    ...(rule.anchorEventId !== null ? { anchorEventId: rule.anchorEventId } : {}),
    createdAt: rule.createdAt,
    ...(rule.matchCount !== undefined ? { matchCount: rule.matchCount } : {}),
  };
}
