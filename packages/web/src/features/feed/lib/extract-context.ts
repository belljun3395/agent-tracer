import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface ContextSnapshot {
  readonly used: number;
  readonly limit: number;
  readonly percent: number;
  readonly atMs: number;
}

// Canonical keys emitted by Claude Code's StatusLine hook and Codex's
// app-server telemetry. Older snake_case synonyms are kept as fallback
// so the dashboard stays compatible with logs from earlier runtimes.
const USED_KEYS = [
  "contextWindowTotalTokens",
  "used_tokens",
  "usedTokens",
  "used",
  "tokens",
] as const;
const LIMIT_KEYS = [
  "contextWindowSize",
  "limit_tokens",
  "limitTokens",
  "limit",
  "context_limit",
] as const;
const PERCENT_KEYS = ["contextWindowUsedPct", "used_percentage", "usedPct"] as const;
const FALLBACK_LIMIT_TOKENS = 200_000;

/**
 * Pick the most recent context snapshot from the timeline. Walks
 * backwards from the latest event so a long-running task shows the
 * "right now" usage. Returns null if no event exposes anything we
 * can convert into a (used, limit, percent) triple.
 *
 * Three accepted shapes, in priority order:
 *
 *   1. used + limit (from `contextWindowTotalTokens` + `contextWindowSize`)
 *   2. percent + limit (rare — the runtime sends used_pct directly)
 *   3. percent only (use a sensible default ceiling so the trajectory
 *      still renders even when the limit is omitted)
 */
export function extractContextSnapshot(
  events: readonly TimelineEventRecord[],
): ContextSnapshot | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (
      event.kind !== "context.snapshot" &&
      event.kind !== "token.usage" &&
      event.kind !== "context.saved"
    ) {
      continue;
    }
    const snapshot = readContextSnapshot(event);
    if (snapshot) return snapshot;
  }
  return null;
}

/**
 * Lower-level reader exposed for batch consumers (trajectory builder,
 * token totals roll-up). Same contract as `extractContextSnapshot`,
 * but operates on a single event.
 */
export function readContextSnapshot(
  event: TimelineEventRecord,
): ContextSnapshot | null {
  const used = readNumber(event.metadata, USED_KEYS);
  const limit = readNumber(event.metadata, LIMIT_KEYS);
  const percent = readNumber(event.metadata, PERCENT_KEYS);
  const atMs = Date.parse(event.createdAt);

  if (used !== null && limit !== null && limit > 0) {
    return {
      used,
      limit,
      percent: Math.round((used / limit) * 100),
      atMs,
    };
  }
  // No raw used count, but the runtime told us the percent directly —
  // back out an effective `used` from `percent * limit` so downstream
  // consumers can render normally.
  if (percent !== null) {
    const effectiveLimit =
      limit !== null && limit > 0 ? limit : FALLBACK_LIMIT_TOKENS;
    return {
      used: Math.round((percent / 100) * effectiveLimit),
      limit: effectiveLimit,
      percent: Math.round(percent),
      atMs,
    };
  }
  return null;
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
