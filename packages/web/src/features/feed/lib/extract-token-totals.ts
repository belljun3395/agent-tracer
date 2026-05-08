import type { TimelineEventRecord } from "~domain/monitoring.js";
import { extractTokens } from "./extract-metadata.js";
import { readContextSnapshot } from "./extract-context.js";

export interface TokenTotals {
  /** Sum of input tokens used across the session. */
  readonly totalIn: number;
  /** Sum of output tokens used across the session. */
  readonly totalOut: number;
  /** Total tokens used. Equals totalIn + totalOut when both are known,
   * otherwise whichever side the runtime reported. */
  readonly totalAll: number;
  /** Peak context-window utilisation seen on any snapshot, in percent. */
  readonly peakContextPercent: number | null;
  /** Timestamp (ms) of the peak snapshot, for "when did it happen". */
  readonly peakContextAtMs: number | null;
  /** How many events contributed something to the rollup — surfaced
   * in the UI as "based on N samples". */
  readonly sampleCount: number;
}

const CUMULATIVE_IN_KEYS = ["contextWindowInputTokens"] as const;
const CUMULATIVE_OUT_KEYS = ["contextWindowOutputTokens"] as const;
const CUMULATIVE_TOTAL_KEYS = ["contextWindowTotalTokens"] as const;

/**
 * Walk the timeline once and roll up token-and-context totals.
 *
 * Two complementary sources, layered:
 *
 *   1. The runtime's `context.snapshot` events report **cumulative**
 *      session totals (`contextWindowInputTokens`, `contextWindowOutputTokens`,
 *      `contextWindowTotalTokens`). For these we keep the LATEST value
 *      we see — adding them up would multiply the same usage many
 *      times over.
 *   2. Individual model/tool events (via `extractTokens`) sometimes
 *      report **per-event** usage instead. Those are summed.
 *
 * If both sources are present we trust the cumulative ones — they're
 * the runtime's authoritative snapshot.
 */
export function buildTokenTotals(
  events: readonly TimelineEventRecord[],
): TokenTotals {
  let perEventIn = 0;
  let perEventOut = 0;
  let perEventTotal = 0;
  let perEventCount = 0;

  let cumulativeIn: number | null = null;
  let cumulativeOut: number | null = null;
  let cumulativeTotal: number | null = null;
  let cumulativeAtMs = -Infinity;
  let cumulativeSampleCount = 0;

  let peakPercent: number | null = null;
  let peakMs: number | null = null;

  for (const event of events) {
    // (1) Cumulative snapshot fields take priority. We only update
    //     when we see a strictly later timestamp so out-of-order
    //     ingestion doesn't roll the totals backward.
    const ts = Date.parse(event.createdAt);
    if (
      event.kind === "context.snapshot" ||
      event.kind === "token.usage" ||
      event.kind === "context.saved"
    ) {
      const snapIn = readNumber(event.metadata, CUMULATIVE_IN_KEYS);
      const snapOut = readNumber(event.metadata, CUMULATIVE_OUT_KEYS);
      const snapTotal = readNumber(event.metadata, CUMULATIVE_TOTAL_KEYS);
      if (snapIn !== null || snapOut !== null || snapTotal !== null) {
        cumulativeSampleCount += 1;
        if (ts > cumulativeAtMs) {
          cumulativeAtMs = ts;
          if (snapIn !== null) cumulativeIn = snapIn;
          if (snapOut !== null) cumulativeOut = snapOut;
          if (snapTotal !== null) cumulativeTotal = snapTotal;
        }
      }

      const snapshot = readContextSnapshot(event);
      if (snapshot && (peakPercent === null || snapshot.percent > peakPercent)) {
        peakPercent = snapshot.percent;
        peakMs = snapshot.atMs;
      }
    }

    // (2) Per-event token usage on individual tool/model events.
    //     Skipped for context.snapshot events — those are the cumulative
    //     source above and adding their values here would double-count.
    if (
      event.kind !== "context.snapshot" &&
      event.kind !== "token.usage" &&
      event.kind !== "context.saved"
    ) {
      const tokens = extractTokens(event);
      if (tokens) {
        perEventCount += 1;
        if (tokens.input !== null) perEventIn += tokens.input;
        if (tokens.output !== null) perEventOut += tokens.output;
        const slice =
          tokens.total !== null
            ? tokens.total
            : (tokens.input ?? 0) + (tokens.output ?? 0);
        perEventTotal += slice;
      }
    }
  }

  // Prefer cumulative when present.
  const hasCumulative =
    cumulativeIn !== null || cumulativeOut !== null || cumulativeTotal !== null;
  const totalIn = hasCumulative ? (cumulativeIn ?? 0) : perEventIn;
  const totalOut = hasCumulative ? (cumulativeOut ?? 0) : perEventOut;
  const totalAll = hasCumulative
    ? cumulativeTotal !== null
      ? cumulativeTotal
      : (cumulativeIn ?? 0) + (cumulativeOut ?? 0)
    : perEventTotal;
  const sampleCount = hasCumulative
    ? cumulativeSampleCount
    : perEventCount;

  return {
    totalIn,
    totalOut,
    totalAll,
    peakContextPercent: peakPercent,
    peakContextAtMs: peakMs,
    sampleCount,
  };
}

function readNumber(
  meta: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}
