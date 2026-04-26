import type { TaskId } from "~domain/monitoring.js";
import type { FetchRulesFilter } from "~io/api.js";

export const monitorQueryKeys = {
    overview: () => ["monitor", "overview"] as const,
    tasks: () => ["monitor", "tasks"] as const,
    taskDetail: (taskId: TaskId) => ["monitor", "task", taskId] as const,
    search: (query: string, taskId?: TaskId) =>
        (taskId ? ["monitor", "search", query, taskId] : ["monitor", "search", query]) as readonly [
            "monitor",
            "search",
            string,
            ...(readonly TaskId[])
        ],
    rules: (filter?: FetchRulesFilter) =>
        ["monitor", "rules", filter?.scope ?? null, filter?.taskId ?? null, filter?.source ?? null] as const,
    taskRules: (taskId: TaskId) => ["monitor", "task", taskId, "rules"] as const,
    verdictCounts: (taskId: TaskId) => ["monitor", "task", taskId, "verdict-counts"] as const,
} as const;

export type MonitorQueryKey =
    | ReturnType<typeof monitorQueryKeys.overview>
    | ReturnType<typeof monitorQueryKeys.tasks>
    | ReturnType<typeof monitorQueryKeys.taskDetail>
    | ReturnType<typeof monitorQueryKeys.search>
    | ReturnType<typeof monitorQueryKeys.rules>
    | ReturnType<typeof monitorQueryKeys.taskRules>
    | ReturnType<typeof monitorQueryKeys.verdictCounts>;
