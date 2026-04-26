import type { TaskId } from "../../types.js";

export const monitorQueryKeys = {
    overview: () => ["monitor", "overview"] as const,
    tasks: () => ["monitor", "tasks"] as const,
    taskDetail: (taskId: TaskId) => ["monitor", "task", taskId] as const,
    taskObservability: (taskId: TaskId) => ["monitor", "task-observability", taskId] as const,
    search: (query: string, taskId?: TaskId) =>
        (taskId ? ["monitor", "search", query, taskId] : ["monitor", "search", query]) as readonly [
            "monitor",
            "search",
            string,
            ...(readonly TaskId[])
        ],
    rules: (filter?: { status?: string; scope?: string; taskId?: string; source?: string }) =>
        (filter
            ? ["monitor", "rules", filter]
            : ["monitor", "rules"]) as readonly unknown[],
} as const;

export type MonitorQueryKey =
    | ReturnType<typeof monitorQueryKeys.overview>
    | ReturnType<typeof monitorQueryKeys.tasks>
    | ReturnType<typeof monitorQueryKeys.taskDetail>
    | ReturnType<typeof monitorQueryKeys.taskObservability>
    | ReturnType<typeof monitorQueryKeys.search>;
