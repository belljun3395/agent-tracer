import type { TaskId } from "~domain/monitoring.js";

/**
 * Centralised query keys. Most v1 routes only need `tasks` and `taskDetail`
 * but the realtime bridge invalidates the broader namespace (`overview`,
 * `taskRules`, `verdictCounts`) on relevant WS messages. Keeping every key
 * defined here lets future hooks plug in without coordinating with the
 * bridge logic.
 */
export const monitorQueryKeys = {
  overview: () => ["monitor", "overview"] as const,
  tasks: () => ["monitor", "tasks"] as const,
  taskDetail: (taskId: TaskId) => ["monitor", "task", taskId] as const,
  taskOpenInference: (taskId: TaskId) =>
    ["monitor", "task", taskId, "openinference"] as const,
  rules: () => ["monitor", "rules"] as const,
  taskRules: (taskId: TaskId) => ["monitor", "task", taskId, "rules"] as const,
  search: (query: string, taskId?: TaskId) =>
    (taskId
      ? ["monitor", "search", query, taskId]
      : ["monitor", "search", query]) as readonly [
      "monitor",
      "search",
      string,
      ...(readonly TaskId[]),
    ],
  verdictCounts: (taskId: TaskId) =>
    ["monitor", "task", taskId, "verdict-counts"] as const,
} as const;

export type MonitorQueryKey =
  | ReturnType<typeof monitorQueryKeys.overview>
  | ReturnType<typeof monitorQueryKeys.tasks>
  | ReturnType<typeof monitorQueryKeys.taskDetail>
  | ReturnType<typeof monitorQueryKeys.taskOpenInference>
  | ReturnType<typeof monitorQueryKeys.rules>
  | ReturnType<typeof monitorQueryKeys.taskRules>
  | ReturnType<typeof monitorQueryKeys.search>
  | ReturnType<typeof monitorQueryKeys.verdictCounts>;
