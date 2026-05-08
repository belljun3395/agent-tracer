import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface ContextSnapshot {
  readonly used: number;
  readonly limit: number;
  readonly percent: number;
  readonly atMs: number;
}

const USED_KEYS = ["used_tokens", "usedTokens", "used", "tokens"];
const LIMIT_KEYS = ["limit_tokens", "limitTokens", "limit", "context_limit"];

/**
 * Pick the most recent context snapshot from the timeline. Walks
 * backwards from the latest event so a long-running task shows the
 * "right now" usage. Returns null if no event exposes both used + limit.
 *
 * Server emits `context.snapshot` events but `token.usage` events also
 * carry the same metadata when the runtime piggybacks usage data into
 * model responses.
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
    const used = readNumber(event.metadata, USED_KEYS);
    const limit = readNumber(event.metadata, LIMIT_KEYS);
    if (used === null || limit === null || limit <= 0) continue;
    return {
      used,
      limit,
      percent: Math.round((used / limit) * 100),
      atMs: Date.parse(event.createdAt),
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
