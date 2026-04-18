import type { TaskId } from "@monitor/domain";
import type {
    BookmarksResponse,
    OverviewResponse,
    TaskDetailResponse,
    TasksResponse
} from "@monitor/web-domain";
import {
    fetchBookmarks,
    fetchOverview,
    fetchTaskDetail,
    fetchTasks
} from "@monitor/web-io";
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
