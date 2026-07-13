import type { MonitoringTask } from "~web/entities/task/model/task.js";
import {
  SIDEBAR_FILTERS,
  type SidebarFilter,
} from "~web/shared/store/slices/sidebarSlice.js";

function matchesFilter(task: MonitoringTask, filter: SidebarFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "live":
      return task.status === "running" || task.status === "waiting";
    case "attn":
      return task.status === "errored";
    case "done":
      return task.status === "completed";
  }
}

export function filterTasks(
  tasks: readonly MonitoringTask[],
  filter: SidebarFilter,
  searchQuery: string,
): readonly MonitoringTask[] {
  const query = searchQuery.trim().toLowerCase();
  return tasks.filter((task) => {
    if (query.length > 0) {
      const title = (task.displayTitle ?? task.title).toLowerCase();
      if (!title.includes(query)) return false;
    }
    return matchesFilter(task, filter);
  });
}

export function countByFilter(
  tasks: readonly MonitoringTask[],
): Readonly<Record<SidebarFilter, number>> {
  const counts = Object.fromEntries(
    SIDEBAR_FILTERS.map((filter) => [filter, 0]),
  ) as Record<SidebarFilter, number>;
  for (const task of tasks) {
    for (const filter of SIDEBAR_FILTERS) {
      if (matchesFilter(task, filter)) counts[filter] += 1;
    }
  }
  return counts;
}
