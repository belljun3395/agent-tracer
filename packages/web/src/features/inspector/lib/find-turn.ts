import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";

/**
 * Returns the turn that contains the event's timestamp, or undefined when
 * no turn matches (events outside any turn window, or when turns is empty).
 *
 * Open turns (no `endedAt`) are treated as half-open up to "now" — events
 * landing after the start of an open turn match.
 */
export function findTurnForEvent(
  event: TimelineEventRecord,
  turns: readonly TaskTurnSummary[],
): TaskTurnSummary | undefined {
  const eventMs = Date.parse(event.createdAt);
  return turns.find((turn) => {
    const startMs = Date.parse(turn.startedAt);
    const endMs = turn.endedAt ? Date.parse(turn.endedAt) : Number.POSITIVE_INFINITY;
    return eventMs >= startMs && eventMs < endMs;
  });
}
