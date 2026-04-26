import type { TaskId } from "../../types.js";
import type {
    OverviewResponse,
    TaskDetailResponse,
    TasksResponse
} from "../../types.js";
import {
    fetchOverview,
    fetchTaskDetail,
    fetchTasks
} from "../../io.js";
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
