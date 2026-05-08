import { formatHHmm, formatHHmmss } from "~features/feed/lib/format-time.js";
import type { TimeRange } from "./time-range.js";

export interface AxisTick {
  readonly leftPercent: number;
  readonly label: string;
  readonly major: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Build axis ticks for the graph's bottom edge.
 *
 * Rules:
 *   - Span < 5 min  → tick every 30s, mono "MM:SS" labels
 *   - Span < 1 h    → tick every 5 min, "HH:mm" labels
 *   - Span < 24 h   → tick every 30 min, "HH:mm" labels
 *   - Otherwise     → ~8 evenly spaced ticks (fallback)
 *
 * First and last ticks are forced major; the half-way one is too. This
 * gives the axis enough rhythm without crowding.
 */
export function buildAxisTicks(range: TimeRange): readonly AxisTick[] {
  const stepMs = pickStep(range.spanMs);
  const ticks: AxisTick[] = [];
  const startMs = Math.ceil(range.minMs / stepMs) * stepMs;
  const useSeconds = range.spanMs < 5 * MINUTE;

  for (let ms = startMs; ms <= range.maxMs; ms += stepMs) {
    const leftPercent = ((ms - range.minMs) / range.spanMs) * 100;
    if (leftPercent < 0 || leftPercent > 100) continue;
    ticks.push({
      leftPercent,
      label: useSeconds ? formatHHmmss(ms) : formatHHmm(ms),
      major: false,
    });
  }
  if (ticks.length > 0) {
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    if (first) ticks[0] = { ...first, major: true };
    if (last) ticks[ticks.length - 1] = { ...last, major: true };
    const midIdx = Math.floor(ticks.length / 2);
    const mid = ticks[midIdx];
    if (mid) ticks[midIdx] = { ...mid, major: true };
  }
  return ticks;
}

function pickStep(spanMs: number): number {
  if (spanMs < 5 * MINUTE) return 30_000;
  if (spanMs < HOUR) return 5 * MINUTE;
  if (spanMs < 24 * HOUR) return 30 * MINUTE;
  return Math.max(MINUTE, Math.floor(spanMs / 8));
}
