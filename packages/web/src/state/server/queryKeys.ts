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
  tasks: (archived: "active" | "archived" | "all" = "active") =>
    ["monitor", "tasks", archived] as const,
  /** Prefix that matches every tasks() variant — use for cross-scope invalidations. */
  tasksPrefix: () => ["monitor", "tasks"] as const,
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
  settings: () => ["monitor", "settings"] as const,
  ruleEvidence: (taskId: TaskId, ruleId: string) =>
    ["monitor", "task", taskId, "rule", ruleId, "evidence"] as const,
  taskCleanupSuggestions: (status: "pending" | "all" = "pending") =>
    ["monitor", "task-cleanup", "suggestions", status] as const,
  taskCleanupSuggestionsPrefix: () =>
    ["monitor", "task-cleanup", "suggestions"] as const,
  taskCleanupLatestJob: () =>
    ["monitor", "task-cleanup", "job", "latest"] as const,
  recipeCandidates: (status: "pending" | "all" = "pending") =>
    ["monitor", "recipes", "candidates", status] as const,
  recipeCandidatesPrefix: () => ["monitor", "recipes", "candidates"] as const,
  recipes: (status: "active" | "superseded" | "retired" | "all" = "active") =>
    ["monitor", "recipes", "list", status] as const,
  recipesPrefix: () => ["monitor", "recipes", "list"] as const,
  recipeScanLatestJob: () =>
    ["monitor", "recipes", "scan", "job", "latest"] as const,
} as const;

export type MonitorQueryKey =
  | ReturnType<typeof monitorQueryKeys.overview>
  | ReturnType<typeof monitorQueryKeys.tasks>
  | ReturnType<typeof monitorQueryKeys.taskDetail>
  | ReturnType<typeof monitorQueryKeys.taskOpenInference>
  | ReturnType<typeof monitorQueryKeys.rules>
  | ReturnType<typeof monitorQueryKeys.taskRules>
  | ReturnType<typeof monitorQueryKeys.search>
  | ReturnType<typeof monitorQueryKeys.verdictCounts>
  | ReturnType<typeof monitorQueryKeys.settings>
  | ReturnType<typeof monitorQueryKeys.ruleEvidence>
  | ReturnType<typeof monitorQueryKeys.taskCleanupSuggestions>
  | ReturnType<typeof monitorQueryKeys.taskCleanupLatestJob>
  | ReturnType<typeof monitorQueryKeys.recipeCandidates>
  | ReturnType<typeof monitorQueryKeys.recipes>
  | ReturnType<typeof monitorQueryKeys.recipeScanLatestJob>;
