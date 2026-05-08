import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface TimeRange {
  readonly minMs: number;
  readonly maxMs: number;
  readonly spanMs: number;
}

const MIN_SPAN_MS = 60_000; // 1 minute floor — keeps short tasks readable

/**
 * Time window the graph should map onto its horizontal extent.
 *
 *   - empty events    → synthesise a 1-minute window ending at `nowMs`
 *   - active task     → from earliest event to max(nowMs, latest event)
 *   - frozen task     → from earliest event to latest event only
 *
 * `freezeAtLastEvent` is set true when the task is no longer producing
 * events (completed / errored / awaiting input). Without it the right
 * edge keeps creeping forward every clock tick, pushing all nodes
 * leftward and never letting the operator settle on a stable layout.
 */
export function buildTimeRange(
  events: readonly TimelineEventRecord[],
  nowMs: number,
  options: { readonly freezeAtLastEvent?: boolean } = {},
): TimeRange {
  if (events.length === 0) {
    return { minMs: nowMs - MIN_SPAN_MS, maxMs: nowMs, spanMs: MIN_SPAN_MS };
  }
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    const ts = Date.parse(event.createdAt);
    if (ts < minMs) minMs = ts;
    if (ts > maxMs) maxMs = ts;
  }
  if (!options.freezeAtLastEvent) {
    maxMs = Math.max(maxMs, nowMs);
  }
  let spanMs = maxMs - minMs;
  if (spanMs < MIN_SPAN_MS) {
    spanMs = MIN_SPAN_MS;
    maxMs = minMs + MIN_SPAN_MS;
  }
  return { minMs, maxMs, spanMs };
}

/** Project an arbitrary timestamp to its 0..100 horizontal percent. */
export function msToLeftPercent(ms: number, range: TimeRange): number {
  const raw = ((ms - range.minMs) / range.spanMs) * 100;
  return clamp(raw, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
