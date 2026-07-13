import type { MonitoringTask } from "~web/entities/task/model/task.js";

/** 태스크는 사용자가 마지막으로 열어본 뒤 활동이 있으면 "unread"다. */
export function isTaskUnread(
  task: MonitoringTask,
  lastSeenAt: Readonly<Record<string, number>>,
): boolean {
  const seen = lastSeenAt[task.id];
  if (seen === undefined) return true;
  return Date.parse(task.updatedAt) > seen;
}
