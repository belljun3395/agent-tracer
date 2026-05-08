import type { TaskId } from "~domain/monitoring.js";
import type { TaskOpenInferenceResponse } from "~domain/openinference.js";
import type { RulesListResponse, TaskRulesResponse } from "~domain/rule.js";
import type { SearchResponse } from "~domain/search-contracts.js";
import type {
  TaskDetailResponse,
  TasksResponse,
} from "~domain/task-query-contracts.js";
import {
  fetchRules,
  fetchSearch,
  fetchTaskDetail,
  fetchTaskOpenInference,
  fetchTaskRules,
  fetchTasks,
} from "~io/api.js";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { monitorQueryKeys } from "./queryKeys.js";

export function useTasksQuery(): UseQueryResult<TasksResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.tasks(),
    queryFn: fetchTasks,
  });
}

export function useTaskDetailQuery(
  taskId: TaskId | null,
): UseQueryResult<TaskDetailResponse> {
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
    enabled: taskId !== null,
  });
}

export function useTaskOpenInferenceQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<TaskOpenInferenceResponse> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskOpenInference(taskId)
      : monitorQueryKeys.taskOpenInference("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskOpenInferenceQuery called without a taskId");
      }
      return fetchTaskOpenInference(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
  });
}

export function useRulesQuery(): UseQueryResult<RulesListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.rules(),
    queryFn: fetchRules,
  });
}

export function useTaskRulesQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<TaskRulesResponse> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskRules(taskId)
      : monitorQueryKeys.taskRules("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskRulesQuery called without a taskId");
      }
      return fetchTaskRules(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
  });
}

/**
 * Backend full-text search across tasks + events.
 *
 * Empty queries are short-circuited (the hook stays disabled) so the
 * sidebar can keep its task-list mode untouched until the user types.
 * Pass an already-debounced query string from the call-site — see
 * `useDebouncedValue`.
 */
export function useSearchQuery(
  query: string,
  options?: { readonly taskId?: TaskId; readonly limit?: number },
): UseQueryResult<SearchResponse> {
  const trimmed = query.trim();
  return useQuery({
    queryKey: monitorQueryKeys.search(trimmed, options?.taskId),
    queryFn: () =>
      fetchSearch(trimmed, {
        ...(options?.taskId ? { taskId: options.taskId } : {}),
        ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      }),
    enabled: trimmed.length > 0,
  });
}
