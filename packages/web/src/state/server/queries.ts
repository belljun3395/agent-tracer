import type { TaskId } from "../../types.js";
import type {
    OverviewResponse,
    TaskDetailResponse,
    TasksResponse
} from "../../types.js";
import {
    fetchOverview,
    fetchTaskDetail,
    fetchTasks,
    getRules,
    type FlatRulesResponse,
    type GetRulesFilter
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

export function useRulesQuery(filter?: GetRulesFilter): UseQueryResult<FlatRulesResponse> {
    return useQuery({
        queryKey: monitorQueryKeys.rules(filter as Record<string, string> | undefined),
        queryFn: () => getRules(filter),
    });
}

export function useTaskRulesQuery(taskId: TaskId | null): UseQueryResult<FlatRulesResponse> {
    return useQuery({
        queryKey: monitorQueryKeys.rules(
            taskId ? { taskId: String(taskId) } : undefined,
        ),
        queryFn: () => {
            if (!taskId) {
                throw new Error("useTaskRulesQuery called without a taskId");
            }
            return getRules({ taskId });
        },
        enabled: taskId !== null,
    });
}
