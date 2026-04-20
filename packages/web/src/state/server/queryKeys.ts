import type { TaskId } from "../../types.js";

export const monitorQueryKeys = {
    overview: () => ["monitor", "overview"] as const,
    tasks: () => ["monitor", "tasks"] as const,
    taskDetail: (taskId: TaskId) => ["monitor", "task", taskId] as const,
    taskObservability: (taskId: TaskId) => ["monitor", "task-observability", taskId] as const,
    bookmarks: (taskId?: TaskId) =>
        (taskId ? ["monitor", "bookmarks", taskId] : ["monitor", "bookmarks"]) as readonly [
            "monitor",
            "bookmarks",
            ...(readonly TaskId[])
        ],
    search: (query: string, taskId?: TaskId) =>
        (taskId ? ["monitor", "search", query, taskId] : ["monitor", "search", query]) as readonly [
            "monitor",
            "search",
            string,
            ...(readonly TaskId[])
        ],
    ruleCommands: (taskId?: TaskId) =>
        (taskId ? ["monitor", "rule-commands", taskId] : ["monitor", "rule-commands"]) as readonly string[],
} as const;

export type MonitorQueryKey =
    | ReturnType<typeof monitorQueryKeys.overview>
    | ReturnType<typeof monitorQueryKeys.tasks>
    | ReturnType<typeof monitorQueryKeys.taskDetail>
    | ReturnType<typeof monitorQueryKeys.taskObservability>
    | ReturnType<typeof monitorQueryKeys.bookmarks>
    | ReturnType<typeof monitorQueryKeys.search>;
