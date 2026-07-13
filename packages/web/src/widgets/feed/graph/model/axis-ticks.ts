import { formatHHmm, formatHHmmss } from "~web/shared/lib/formatting/time.js";
import type { TimeRange } from "~web/widgets/feed/graph/model/time-range.js";

export interface AxisTick {
  readonly leftPercent: number;
  readonly label: string;
  readonly major: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** 시간 창의 폭에 맞는 하단 축 눈금을 만든다. */
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
