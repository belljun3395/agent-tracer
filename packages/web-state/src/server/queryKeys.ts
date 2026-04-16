import type { TaskId } from "@monitor/core";

export const monitorQueryKeys = {
    overview: () => ["monitor", "overview"] as const,
    tasks: () => ["monitor", "tasks"] as const,
    taskDetail: (taskId: TaskId) => ["monitor", "task", taskId] as const,
    bookmarks: (taskId?: TaskId) =>
        (taskId ? ["monitor", "bookmarks", taskId] : ["monitor", "bookmarks"]) as readonly [
            "monitor",
            "bookmarks",
            ...(readonly TaskId[])
        ]
} as const;

export type MonitorQueryKey =
    | ReturnType<typeof monitorQueryKeys.overview>
    | ReturnType<typeof monitorQueryKeys.tasks>
    | ReturnType<typeof monitorQueryKeys.taskDetail>
    | ReturnType<typeof monitorQueryKeys.bookmarks>;
