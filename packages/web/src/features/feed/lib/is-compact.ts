import type { TimelineEventRecord } from "~domain/monitoring.js";

/**
 * `kind === "context.saved"` is overloaded by the runtime — it's emitted
 * by SessionStart, PostToolBatch, ConfigChange, CwdChanged, Notification,
 * ModeChange, and others, in addition to actual context compaction
 * (PreCompact / PostCompact).
 *
 * The truth marker is `metadata.compactPhase` ("before" | "after"), which
 * only the compact hooks set. Filtering by it stops the feed/graph from
 * treating every session checkpoint as a PreCompact stripe.
 */
export function isContextCompactEvent(event: TimelineEventRecord): boolean {
  if (event.kind !== "context.saved") return false;
  const phase = event.metadata["compactPhase"];
  return phase === "before" || phase === "after";
}
