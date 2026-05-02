import type { TaskId } from "~domain/monitoring.js";
import type { RulesListResponse, TaskRulesResponse } from "~domain/rule.js";
import type { OverviewResponse, TaskDetailResponse, TasksResponse } from "~domain/task-query-contracts.js";
import { fetchOverview, fetchRules, fetchTaskDetail, fetchTaskRules, fetchTasks } from "~io/api.js";
import type { FetchRulesFilter } from "~io/api.js";
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

export function useRulesQuery(
    filter?: FetchRulesFilter,
    options?: { readonly enabled?: boolean },
): UseQueryResult<RulesListResponse> {
    return useQuery({
        queryKey: monitorQueryKeys.rules(filter),
        queryFn: () => fetchRules(filter),
        enabled: options?.enabled ?? true,
    });
}

export function useTaskRulesQuery(taskId: TaskId | null): UseQueryResult<TaskRulesResponse> {
    return useQuery({
        queryKey: taskId
            ? monitorQueryKeys.taskRules(taskId)
            : monitorQueryKeys.taskRules("__disabled__" as TaskId),
        queryFn: () => {
            if (!taskId) throw new Error("useTaskRulesQuery called without a taskId");
            return fetchTaskRules(taskId);
        },
        enabled: taskId !== null,
    });
}
