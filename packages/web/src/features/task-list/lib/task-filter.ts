import type { MonitoringTask } from "~domain/monitoring.js";
import type { SidebarFilter } from "~state/ui/index.js";

/**
 * Apply the active filter pill + free-text search.
 *
 * Filter semantics (must stay in sync with TaskListFilters labels):
 *   - all   : everything
 *   - live  : running | waiting
 *   - attn  : errored (rule-violation badge can land here once aggregated)
 *   - done  : completed
 *
 * Search is case-insensitive substring match against title or displayTitle.
 */
export function filterTasks(
  tasks: readonly MonitoringTask[],
  filter: SidebarFilter,
  searchQuery: string,
): readonly MonitoringTask[] {
  const q = searchQuery.trim().toLowerCase();
  return tasks.filter((task) => {
    if (q.length > 0) {
      const title = (task.displayTitle ?? task.title).toLowerCase();
      if (!title.includes(q)) return false;
    }
    return matchesFilter(task, filter);
  });
}

export function countByFilter(
  tasks: readonly MonitoringTask[],
): Readonly<Record<SidebarFilter, number>> {
  return {
    all: tasks.length,
    live: tasks.filter((t) => t.status === "running" || t.status === "waiting").length,
    attn: tasks.filter((t) => t.status === "errored").length,
    done: tasks.filter((t) => t.status === "completed").length,
  };
}

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
