import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";

export function findTurnAtMs(
  ms: number,
  turns: readonly TaskTurnSummary[],
): TaskTurnSummary | undefined {
  return turns.find((turn) => {
    const startMs = Date.parse(turn.startedAt);
    const endMs = turn.endedAt
      ? Date.parse(turn.endedAt)
      : Number.POSITIVE_INFINITY;
    return ms >= startMs && ms < endMs;
  });
}
