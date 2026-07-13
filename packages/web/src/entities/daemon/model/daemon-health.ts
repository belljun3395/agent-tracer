import type { DaemonHealthSnapshotDto } from "@monitor/kernel";

export const DAEMON_HEALTH_STALE_THRESHOLD_MS = 10 * 60 * 1000;

export interface DaemonHealthResponse {
  readonly snapshot: DaemonHealthSnapshotDto | null;
}

export function isDaemonHealthStale(reportedAt: string, nowMs: number): boolean {
  const reportedAtMs = Date.parse(reportedAt);
  if (Number.isNaN(reportedAtMs)) return true;
  return nowMs - reportedAtMs > DAEMON_HEALTH_STALE_THRESHOLD_MS;
}
