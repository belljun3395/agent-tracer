import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";

export type EdgeKind = "causal" | "explicit";

export interface FeedEdge {
  readonly kind: EdgeKind;
  readonly fromEventId: string;
  readonly toEventId: string;
}

/**
 * Build edges between events for the swimlane graph.
 *
 * Two sources, layered (explicit wins on duplicate pairs):
 *
 *   (1) `metadata.parentEventId` / `metadata.sourceEventId` — when an
 *       event explicitly names its predecessor, draw a dashed edge.
 *   (2) Chain every event to its chronological predecessor. Operators
 *       expect "I see what happened next" continuity even across turn
 *       boundaries — gating the chain on turn membership left the graph
 *       full of orphan nodes whenever events landed between turns or
 *       turn data was sparse.
 *
 * `turns` is accepted for API compatibility but no longer consulted —
 * keeping it in the signature lets callers pass the data they already
 * have without churn.
 */
export function buildFeedEdges(
  events: readonly TimelineEventRecord[],
  _turns: readonly TaskTurnSummary[],
): readonly FeedEdge[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const eventIds = new Set<string>(sorted.map((e) => e.id));
  const seen = new Set<string>(); // dedupe key: `${from}→${to}`
  const out: FeedEdge[] = [];
  const push = (kind: EdgeKind, fromEventId: string, toEventId: string) => {
    if (fromEventId === toEventId) return;
    if (!eventIds.has(fromEventId)) return;
    const key = `${fromEventId}→${toEventId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, fromEventId, toEventId });
  };

  // Pass 1 — explicit parent links from metadata.
  for (const event of sorted) {
    const explicit = readExplicitParent(event);
    if (explicit) push("explicit", explicit, event.id);
  }

  // Pass 2 — chain every consecutive pair chronologically.
  for (let i = 1; i < sorted.length; i += 1) {
    push("causal", sorted[i - 1]!.id, sorted[i]!.id);
  }

  return out;
}

function readExplicitParent(event: TimelineEventRecord): string | null {
  const meta = event.metadata;
  for (const key of ["parentEventId", "parent_event_id", "sourceEventId", "source_event_id"]) {
    const v = meta[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}
