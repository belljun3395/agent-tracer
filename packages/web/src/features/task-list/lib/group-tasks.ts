import type { MonitoringTask } from "~domain/monitoring.js";

export type TaskGroupKey = "live" | "today" | "yesterday" | "older";

export interface TaskGroup {
  readonly key: TaskGroupKey;
  readonly label: string;
  readonly tasks: readonly MonitoringTask[];
}

/**
 * Group tasks for the sidebar. v6's three-band rhythm:
 *   - Live   : status == running | waiting (always pinned to top)
 *   - Today  : updatedAt within today
 *   - Yesterday
 *   - Older  : everything else
 *
 * Groups are emitted in fixed order; empty groups are dropped so the
 * sidebar never shows a "Yesterday (0)" header. Within each group tasks
 * are sorted by `updatedAt` descending — newest activity floats up.
 */
export function groupTasksByTime(
  tasks: readonly MonitoringTask[],
  nowMs: number,
): readonly TaskGroup[] {
  const startOfToday = startOfDay(nowMs);
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const live: MonitoringTask[] = [];
  const today: MonitoringTask[] = [];
  const yesterday: MonitoringTask[] = [];
  const older: MonitoringTask[] = [];

  for (const task of tasks) {
    if (task.status === "running" || task.status === "waiting") {
      live.push(task);
      continue;
    }
    const ts = Date.parse(task.updatedAt);
    if (ts >= startOfToday) today.push(task);
    else if (ts >= startOfYesterday) yesterday.push(task);
    else older.push(task);
  }

  const sortDesc = (a: MonitoringTask, b: MonitoringTask) =>
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  live.sort(sortDesc);
  today.sort(sortDesc);
  yesterday.sort(sortDesc);
  older.sort(sortDesc);

  const out: TaskGroup[] = [];
  if (live.length) out.push({ key: "live", label: "Live", tasks: live });
  if (today.length) out.push({ key: "today", label: "Today", tasks: today });
  if (yesterday.length)
    out.push({ key: "yesterday", label: "Yesterday", tasks: yesterday });
  if (older.length) out.push({ key: "older", label: "Older", tasks: older });
  return out;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
