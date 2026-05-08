import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { EventSubtypeKey } from "~domain/classification.js";

export interface ToolUsageRow {
  readonly subtype: EventSubtypeKey;
  readonly label: string;
  readonly count: number;
  readonly lastSeenAtMs: number;
}

/**
 * Tally subtype frequency for the task. Useful at a glance to answer
 * "what is this agent mostly doing?" — heavy `apply_patch` reads as
 * implementation, heavy `grep_code` reads as exploration, etc.
 *
 * Excludes 'uncategorized' so noise from un-typed events doesn't crowd
 * the leaderboard.
 */
export function buildToolUsage(
  events: readonly TimelineEventRecord[],
): readonly ToolUsageRow[] {
  type Aggregate = {
    label: string;
    count: number;
    lastSeenAtMs: number;
  };
  const bySubtype = new Map<EventSubtypeKey, Aggregate>();

  for (const event of events) {
    const semantic = event.semantic;
    if (!semantic) continue;
    if (semantic.subtypeKey === "uncategorized") continue;
    const ms = Date.parse(event.createdAt);
    let agg = bySubtype.get(semantic.subtypeKey);
    if (!agg) {
      agg = {
        label: semantic.subtypeLabel,
        count: 0,
        lastSeenAtMs: ms,
      };
      bySubtype.set(semantic.subtypeKey, agg);
    }
    agg.count += 1;
    if (ms > agg.lastSeenAtMs) agg.lastSeenAtMs = ms;
  }

  return Array.from(bySubtype.entries())
    .map(([subtype, agg]) => ({ subtype, ...agg }))
    .sort((a, b) => b.count - a.count);
}
