import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import type { VerdictStatus } from "~domain/rule.js";
import { classifyEvent, type ActVm } from "./act-classification.js";
import { formatHHmmss } from "./format-time.js";
import { findTurnAtMs } from "./find-turn-at.js";
import { isContextCompactEvent } from "./is-compact.js";
import { readContextSnapshot } from "./extract-context.js";

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
  | {
      readonly kind: "context-mark";
      readonly percent: number;
      readonly used: number;
      readonly limit: number;
      readonly model: string | null;
      /** True when the model identity changed at this point. */
      readonly modelChanged: boolean;
      /** Signed delta from the last emitted mark, in percentage points. */
      readonly deltaPct: number;
    }
  | { readonly kind: "act"; readonly vm: ActVm };

const CONTEXT_DELTA_THRESHOLD = 5;

const MODEL_KEYS = ["modelId", "model_id", "model"] as const;

function readModel(meta: Record<string, unknown>): string | null {
  for (const key of MODEL_KEYS) {
    const v = meta[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

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
  let lastEmittedContextPct: number | null = null;
  let lastEmittedModel: string | null = null;
  for (const event of sorted) {
    // Context snapshots (model status, token usage) emit inline marks
    // when they materially change the operator's view of the run —
    // either the model rotated, or context % moved by ≥ threshold
    // since the last mark we emitted. Otherwise they're ambient
    // noise and the metric rail / sparkline already covers them.
    if (event.kind === "context.snapshot") {
      const snapshot = readContextSnapshot(event);
      if (snapshot) {
        const model = readModel(event.metadata);
        const modelChanged =
          model !== null && lastEmittedModel !== null && model !== lastEmittedModel;
        const deltaPct =
          lastEmittedContextPct === null
            ? snapshot.percent
            : snapshot.percent - lastEmittedContextPct;
        const significantContext =
          lastEmittedContextPct === null ||
          Math.abs(deltaPct) >= CONTEXT_DELTA_THRESHOLD;
        if (modelChanged || significantContext) {
          items.push({
            kind: "context-mark",
            percent: snapshot.percent,
            used: snapshot.used,
            limit: snapshot.limit,
            model,
            modelChanged,
            deltaPct,
          });
          lastEmittedContextPct = snapshot.percent;
          if (model !== null) lastEmittedModel = model;
        } else if (model !== null && lastEmittedModel === null) {
          // Latch the first observed model so subsequent comparisons
          // can detect a change, even if the context % was stable.
          lastEmittedModel = model;
        }
      }
      // Don't fall through to the ActCard render — the mark replaces it.
      continue;
    }
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
