import { KIND } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { readContextSnapshot } from "~web/widgets/feed/lib/extraction/extract-context.js";

export interface TrajectoryPoint {
  readonly atMs: number;
  readonly used: number;
  readonly limit: number;
  readonly percent: number;
}

/** (used, limit, percent) 샘플을 시간순으로 나열한 목록. */
export function buildContextTrajectory(
  events: readonly TimelineEventRecord[],
): readonly TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (const event of events) {
    if (
      event.kind !== KIND.contextSnapshot &&
      event.kind !== KIND.tokenUsage &&
      event.kind !== KIND.contextSaved
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
