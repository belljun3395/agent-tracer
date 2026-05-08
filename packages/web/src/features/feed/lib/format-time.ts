/*
 * Feed-specific time formatters. Wall-clock + offset rendered in the time
 * column ("14:03:18 / +5m 33s") and elapsed durations rendered in the
 * MetricRail / TaskHeader byline ("Active 2h 37m").
 */

export function formatHHmmss(input: Date | string | number): string {
  const d = toDate(input);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function formatHHmm(input: Date | string | number): string {
  const d = toDate(input);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Offset relative to a base timestamp — used as the small grey caption
 * under each act's wall-clock time. Examples:
 *   +0s, +6s, +50s, +5m 33s, +2h 24m
 */
export function formatOffset(eventMs: number, baseMs: number): string {
  const seconds = Math.max(0, Math.floor((eventMs - baseMs) / 1000));
  if (seconds < 60) return `+${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `+${m}m ${pad2(seconds % 60)}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `+${h}h ${pad2(m)}m`;
}

/**
 * Long-form duration for the metric rail and task header byline.
 *   45_000ms → "45s"
 *   125_000ms → "2m 5s"
 *   9_400_000ms → "2h 36m"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === "string") return new Date(input);
  return new Date(input);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
