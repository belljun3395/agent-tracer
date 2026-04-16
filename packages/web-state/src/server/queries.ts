import type { TaskId } from "@monitor/core";
// eslint-disable-next-line no-restricted-imports -- legacy api surface pending move to web-io (plan S6/S7)
import {
    fetchBookmarks,
    fetchOverview,
    fetchTaskDetail,
    fetchTasks,
    type BookmarksResponse,
    type OverviewResponse,
    type TaskDetailResponse,
    type TasksResponse
} from "@monitor/web-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { monitorQueryKeys } from "./queryKeys.js";

export function useOverviewQuery(): UseQueryResult<OverviewResponse> {
    return useQuery({
        queryKey: monitorQueryKeys.overview(),
        queryFn: fetchOverview
    });
}

export function useTasksQuery(): UseQueryResult<TasksResponse> {
    return useQuery({
        queryKey: monitorQueryKeys.tasks(),
        queryFn: fetchTasks
    });
}

export function useTaskDetailQuery(taskId: TaskId | null): UseQueryResult<TaskDetailResponse> {
    return useQuery({
        queryKey: taskId
            ? monitorQueryKeys.taskDetail(taskId)
            : monitorQueryKeys.taskDetail("__disabled__" as TaskId),
        queryFn: () => {
            if (!taskId) {
                throw new Error("useTaskDetailQuery called without a taskId");
            }
            return fetchTaskDetail(taskId);
        },
        enabled: taskId !== null
    });
}

export function useBookmarksQuery(taskId?: TaskId): UseQueryResult<BookmarksResponse> {
    return useQuery({
        queryKey: monitorQueryKeys.bookmarks(taskId),
        queryFn: () => fetchBookmarks(taskId)
    });
}
