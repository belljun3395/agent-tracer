import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { RuleId } from "~domain/monitoring.js";

/**
 * Per-rule match counts across the task's timeline.
 *
 * Used by RulesTab to surface "this rule fired N times in this task" so
 * operators see which rules are actually exercised on a given run, vs
 * which sit dormant. The shape mirrors a JS Map<ruleId, count>; we use a
 * Record so React reference equality stays stable when no events change.
 */
export function countRuleMatches(
  events: readonly TimelineEventRecord[],
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const event of events) {
    for (const match of event.classification.matches) {
      const id = match.ruleId;
      out[id] = (out[id] ?? 0) + 1;
    }
  }
  return out;
}

/** Convenience lookup. Returns 0 (never undefined) so renderers can render safely. */
export function ruleMatchCount(
  counts: Readonly<Record<string, number>>,
  ruleId: RuleId | string,
): number {
  return counts[ruleId] ?? 0;
}
