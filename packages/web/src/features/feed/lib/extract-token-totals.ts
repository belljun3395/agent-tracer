import type { TimelineEventRecord } from "~domain/monitoring.js";
import { extractTokens } from "./extract-metadata.js";

export interface TokenTotals {
  /** Sum of `input_tokens` across every event that exposed one. */
  readonly totalIn: number;
  /** Sum of `output_tokens` across every event that exposed one. */
  readonly totalOut: number;
  /** Sum of input + output (uses each event's `total` if present, else
   * falls back to its in+out). */
  readonly totalAll: number;
  /** Peak context-window utilisation seen on any snapshot, in percent. */
  readonly peakContextPercent: number | null;
  /** Timestamp (ms) of the peak snapshot, for "when did it happen". */
  readonly peakContextAtMs: number | null;
  /** How many events contributed to the in/out totals — useful UI hint
   * ("based on N samples"). */
  readonly sampleCount: number;
}

const USED_KEYS = ["used_tokens", "usedTokens", "used", "tokens"];
const LIMIT_KEYS = ["limit_tokens", "limitTokens", "limit", "context_limit"];

/**
 * Walk the timeline once and roll up token-and-context totals. Token
 * sums skip events with no token data; the peak context tracks the
 * single highest used/limit ratio seen across `context.snapshot` /
 * `token.usage` / `context.saved` events.
 */
export function buildTokenTotals(
  events: readonly TimelineEventRecord[],
): TokenTotals {
  let totalIn = 0;
  let totalOut = 0;
  let totalAll = 0;
  let sampleCount = 0;
  let peakPercent: number | null = null;
  let peakMs: number | null = null;

  for (const event of events) {
    const tokens = extractTokens(event);
    if (tokens) {
      sampleCount += 1;
      if (tokens.input !== null) totalIn += tokens.input;
      if (tokens.output !== null) totalOut += tokens.output;
      // Prefer reported total; fall back to in+out so we never
      // double-count when only one side was reported.
      const slice =
        tokens.total !== null
          ? tokens.total
          : (tokens.input ?? 0) + (tokens.output ?? 0);
      totalAll += slice;
    }

    if (
      event.kind === "context.snapshot" ||
      event.kind === "token.usage" ||
      event.kind === "context.saved"
    ) {
      const used = readNumber(event.metadata, USED_KEYS);
      const limit = readNumber(event.metadata, LIMIT_KEYS);
      if (used === null || limit === null || limit <= 0) continue;
      const percent = (used / limit) * 100;
      if (peakPercent === null || percent > peakPercent) {
        peakPercent = Math.round(percent);
        peakMs = Date.parse(event.createdAt);
      }
    }
  }

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
