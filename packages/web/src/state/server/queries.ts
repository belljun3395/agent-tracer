import type { TaskId } from "~domain/monitoring.js";
import type { TaskOpenInferenceResponse } from "~domain/openinference.js";
import type { RulesListResponse, TaskRulesResponse } from "~domain/rule.js";
import type { SearchResponse } from "~domain/search-contracts.js";
import type {
  TaskDetailResponse,
  TasksResponse,
} from "~domain/task-query-contracts.js";
import {
  fetchAppSettings,
  fetchLatestGenerateRulesJob,
  fetchLatestTaskCleanupJob,
  fetchRuleEvidence,
  fetchRules,
  fetchSearch,
  fetchTaskCleanupSuggestions,
  fetchTaskDetail,
  fetchTaskOpenInference,
  fetchTaskRules,
  fetchTasks,
  type AppSettingsListResponse,
  type CleanupSuggestionsResponse,
  type GenerateRulesJobStatus,
  type RuleEvidenceResponse,
  type TaskCleanupJobStatus,
  type TasksArchivedScope,
} from "~io/api.js";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { monitorQueryKeys } from "./queryKeys.js";

export function useTasksQuery(
  archived: TasksArchivedScope = "active",
): UseQueryResult<TasksResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.tasks(archived),
    queryFn: () => fetchTasks(archived),
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
export function useRuleEvidenceQuery(
  taskId: TaskId | null,
  ruleId: string | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<RuleEvidenceResponse> {
  return useQuery({
    queryKey:
      taskId && ruleId
        ? monitorQueryKeys.ruleEvidence(taskId, ruleId)
        : monitorQueryKeys.ruleEvidence(
            "__disabled__" as TaskId,
            "__disabled__",
          ),
    queryFn: () => {
      if (!taskId || !ruleId) {
        throw new Error("useRuleEvidenceQuery called without taskId/ruleId");
      }
      return fetchRuleEvidence(taskId, ruleId);
    },
    enabled:
      taskId !== null && ruleId !== null && (options?.enabled ?? true),
  });
}

export function useAppSettingsQuery(): UseQueryResult<AppSettingsListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.settings(),
    queryFn: fetchAppSettings,
  });
}

export function useLatestGenerateRulesJobQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<{ job: GenerateRulesJobStatus | null }> {
  return useQuery({
    queryKey: taskId
      ? ["monitor", "task", taskId, "generate-rules-latest"]
      : ["monitor", "task", "__disabled__", "generate-rules-latest"],
    queryFn: () => {
      if (!taskId) {
        throw new Error("useLatestGenerateRulesJobQuery called without a taskId");
      }
      return fetchLatestGenerateRulesJob(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
    refetchInterval: (q) => {
      const status = q.state.data?.job?.status;
      return status === "pending" || status === "processing" ? 1500 : false;
    },
  });
}

export function useLatestTaskCleanupJobQuery(
  options?: { readonly enabled?: boolean },
): UseQueryResult<{ job: TaskCleanupJobStatus | null }> {
  return useQuery({
    queryKey: monitorQueryKeys.taskCleanupLatestJob(),
    queryFn: fetchLatestTaskCleanupJob,
    enabled: options?.enabled ?? true,
    refetchInterval: (q) => {
      const status = q.state.data?.job?.status;
      return status === "pending" || status === "processing" ? 1500 : false;
    },
  });
}

export function useTaskCleanupSuggestionsQuery(
  status: "pending" | "all" = "pending",
): UseQueryResult<CleanupSuggestionsResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.taskCleanupSuggestions(status),
    queryFn: () => fetchTaskCleanupSuggestions(status),
  });
}

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
