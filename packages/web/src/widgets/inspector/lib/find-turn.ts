import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";

/** 이벤트의 타임스탬프를 포함하는 턴을 반환한다. */
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
