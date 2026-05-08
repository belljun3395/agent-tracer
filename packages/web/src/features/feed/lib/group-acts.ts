import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import type { VerdictStatus } from "~domain/rule.js";
import { classifyEvent, type ActVm } from "./act-classification.js";
import { formatHHmmss } from "./format-time.js";
import { findTurnAtMs } from "./find-turn-at.js";
import { isContextCompactEvent } from "./is-compact.js";

/**
 * Time-marks split the vertical feed into bands; acts are the actual cards.
 *
 *   ── Task started · 14:03:12 ──        (kind: 'time-mark', tone: 'normal')
 *   ── Turn 1 · verified ──              (kind: 'turn-mark')
 *   [act] [act] [act]
 *   ── Turn 2 · pending ──               (kind: 'turn-mark')
 *   [act]
 *   ── Context compacted ──              (kind: 'time-mark', tone: 'compact')
 *   [act]
 *
 * Subagent grouping is intentionally absent — the feed renders flat time
 * order. SubagentBlock rendering lands when the backend exposes parent/
 * child task linking on the timeline payload.
 */
export type FeedItem =
  | {
      readonly kind: "time-mark";
      readonly label: string;
      readonly tone: "normal" | "compact";
      /** Number of consecutive merged events when > 1 (compact tone). */
      readonly count?: number;
    }
  | {
      readonly kind: "turn-mark";
      readonly turnIndex: number;
      readonly verdict: VerdictStatus | null;
      readonly status: "open" | "closed";
    }
  | { readonly kind: "act"; readonly vm: ActVm };

export function buildFeed(
  events: readonly TimelineEventRecord[],
  baseMs: number,
  turns: readonly TaskTurnSummary[] = [],
): readonly FeedItem[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  const items: FeedItem[] = [];
  if (sorted.length > 0) {
    items.push({
      kind: "time-mark",
      label: `Task started · ${formatHHmmss(baseMs)}`,
      tone: "normal",
    });
  }

  let lastTurnIndex: number | null = null;
  for (const event of sorted) {
    if (isContextCompactEvent(event)) {
      // Collapse a run of consecutive compacts into one divider — without
      // this, an agent that auto-compacts 5× in a row floods the feed
      // with dashed amber lines and drowns out actual work.
      const tail = items[items.length - 1];
      if (tail && tail.kind === "time-mark" && tail.tone === "compact") {
        items[items.length - 1] = {
          ...tail,
          count: (tail.count ?? 1) + 1,
        };
      } else {
        items.push({
          kind: "time-mark",
          label: "Context compacted",
          tone: "compact",
        });
      }
      continue;
    }

    // When this event lands in a different turn from the previous one,
    // emit a turn-mark *before* the act. This keeps the divider attached
    // to the start of the band, mirroring the "Context compacted" pattern.
    const turn = findTurnAtMs(Date.parse(event.createdAt), turns);
    if (turn && turn.turnIndex !== lastTurnIndex) {
      items.push({
        kind: "turn-mark",
        turnIndex: turn.turnIndex,
        verdict: turn.aggregateVerdict,
        status: turn.status,
      });
      lastTurnIndex = turn.turnIndex;
    }

    items.push({ kind: "act", vm: classifyEvent(event, baseMs) });
  }
  return items;
}
