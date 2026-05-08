import type { MonitoringTask } from "~domain/monitoring.js";

/**
 * A task is "unread" when there's been activity since the user last opened it.
 * Fresh tasks (never seen) are unread by default — that's what surfaces new
 * runs to the sidebar.
 *
 * Uses `updatedAt` as a proxy for last-event timestamp because the tasks
 * list response doesn't carry a per-event count yet (see plan v1 hide table).
 */
export function isTaskUnread(
  task: MonitoringTask,
  lastSeenAt: Readonly<Record<string, number>>,
): boolean {
  const seen = lastSeenAt[task.id];
  if (seen === undefined) return true;
  return Date.parse(task.updatedAt) > seen;
}
