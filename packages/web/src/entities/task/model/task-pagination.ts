import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TasksResponse } from "~web/entities/task/model/task-query.js";

export function flattenTaskPages(pages: readonly TasksResponse[]): readonly MonitoringTask[] {
  return pages.flatMap((page) => page.tasks);
}
