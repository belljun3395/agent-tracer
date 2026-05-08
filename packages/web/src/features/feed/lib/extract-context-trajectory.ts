import type { TimelineEventRecord } from "~domain/monitoring.js";
import { readContextSnapshot } from "./extract-context.js";

export interface TrajectoryPoint {
  readonly atMs: number;
  readonly used: number;
  readonly limit: number;
  readonly percent: number;
}

/**
 * Time-ordered list of (used / limit / percent) samples — the data a
 * sparkline needs to render the context-window curve. Drops events
 * that don't expose enough metadata to plot, so the resulting series
 * only contains points that can actually be drawn.
 *
 * Reuses `readContextSnapshot` so the trajectory respects the same
 * canonical-vs-fallback key precedence as the metric rail's "current"
 * cell — keeps the two views from disagreeing about what counts as a
 * valid snapshot.
 */
export function buildContextTrajectory(
  events: readonly TimelineEventRecord[],
): readonly TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (const event of events) {
    if (
      event.kind !== "context.snapshot" &&
      event.kind !== "token.usage" &&
      event.kind !== "context.saved"
    ) {
      continue;
    }
    const snapshot = readContextSnapshot(event);
    if (!snapshot) continue;
    out.push(snapshot);
  }
  out.sort((a, b) => a.atMs - b.atMs);
  return out;
}
