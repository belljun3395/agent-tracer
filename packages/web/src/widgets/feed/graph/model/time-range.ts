import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

export interface TimeRange {
  readonly minMs: number;
  readonly maxMs: number;
  readonly spanMs: number;
}

const MIN_SPAN_MS = 60_000;

/** 그래프 축 범위에서 후속 텔레메트리 꼬리를 제외한다. */
export function axisEventsOf(
  events: readonly TimelineEventRecord[],
): readonly TimelineEventRecord[] {
  const nonTelemetry = events.filter((event) => event.classification.lane !== "telemetry");
  return nonTelemetry.length > 0 ? nonTelemetry : events;
}

/** 이벤트와 실행 상태로 그래프의 시간 창을 계산한다. */
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
    const timestamp = Date.parse(event.createdAt);
    if (timestamp < minMs) minMs = timestamp;
    if (timestamp > maxMs) maxMs = timestamp;
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

/** 타임스탬프를 현재 시간 창의 가로 퍼센트로 투영한다. */
export function msToLeftPercent(ms: number, range: TimeRange): number {
  const raw = ((ms - range.minMs) / range.spanMs) * 100;
  return Math.max(0, Math.min(raw, 100));
}
