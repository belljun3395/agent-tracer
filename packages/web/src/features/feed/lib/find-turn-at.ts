import type { TaskTurnSummary } from "~domain/task-query-contracts.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  USER CONTRIBUTION POINT
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Given a timestamp, return the turn the feed should attribute it to.
 *  Used by `buildFeed` to decide where to insert "Turn N · verdict" dividers.
 *
 *  Design decision (please pick one and implement):
 *
 *  (A) STRICT — only return a turn when ms ∈ [startedAt, endedAt) of some
 *      turn. Gaps between turns return undefined, so the feed shows no
 *      band header for orphan events. Cleanest mathematically but the
 *      feed loses its rhythm during quiet stretches between turns.
 *
 *  (B) STICKY — extend each closed turn forward until the next turn starts.
 *      i.e. an event at t=150 with turn 1 closing at t=100 and turn 2
 *      opening at t=200 still "belongs" to turn 1's band. Most natural
 *      for the feed: no orphan gaps, every event lives under a turn.
 *
 *  (C) ANTICIPATORY — attribute pre-turn events to the upcoming turn so
 *      operator sees "Turn 3 · pending" before turn 3 opens. Useful if
 *      verdicts arrive late, but creates causal weirdness.
 *
 *  Constraints (apply to whichever option you pick):
 *    - turns may be empty                → return undefined
 *    - turns are NOT guaranteed sorted   → don't assume order
 *    - timestamps are ISO strings on the turn record → parse with Date.parse
 *    - open turns have endedAt === null  → treat their end as +Infinity
 *    - return undefined when no turn applies under your chosen rule
 *
 *  Default below implements (A) STRICT — replace the body to switch
 *  behaviour. Roughly 5-10 lines.
 */
export function findTurnAtMs(
  ms: number,
  turns: readonly TaskTurnSummary[],
): TaskTurnSummary | undefined {
  // (A) STRICT default — switch to (B) or (C) per your operator UX.
  return turns.find((turn) => {
    const startMs = Date.parse(turn.startedAt);
    const endMs = turn.endedAt
      ? Date.parse(turn.endedAt)
      : Number.POSITIVE_INFINITY;
    return ms >= startMs && ms < endMs;
  });
}
