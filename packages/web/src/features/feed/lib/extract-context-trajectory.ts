import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface TrajectoryPoint {
  readonly atMs: number;
  readonly used: number;
  readonly limit: number;
  readonly percent: number;
}

const USED_KEYS = ["used_tokens", "usedTokens", "used", "tokens"];
const LIMIT_KEYS = ["limit_tokens", "limitTokens", "limit", "context_limit"];

/**
 * Time-ordered list of (used / limit / percent) samples — the data a
 * sparkline needs to render the context-window curve. Drops events
 * that don't expose both used and limit, so the resulting series only
 * contains points that can actually be plotted.
 */
export function buildContextTrajectory(
  events: readonly TimelineEventRecord[],
): readonly TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (const event of events) {
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
    out.push({
      atMs: Date.parse(event.createdAt),
      used,
      limit,
      percent: (used / limit) * 100,
    });
  }
  out.sort((a, b) => a.atMs - b.atMs);
  return out;
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
