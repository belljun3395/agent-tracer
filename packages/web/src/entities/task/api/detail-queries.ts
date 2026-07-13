import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { TaskOpenInferenceResponse } from "~web/entities/task/model/openinference.js";
import type {
  TaskChildrenResponse,
  TaskDetailResponse,
  TaskUserInput,
} from "~web/entities/task/model/task-query.js";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";
import {
  fetchTaskChildren,
  fetchTaskDetail,
  fetchTaskOpenInference,
  fetchTaskTurns,
  fetchTaskUserInputs,
  fetchTaskVerifications,
} from "~web/entities/task/api/detail.js";
import { fetchTaskTimeline } from "~web/entities/task/api/timeline.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useTaskDetailQuery(taskId: TaskId | null): UseQueryResult<TaskDetailResponse> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskDetail(taskId)
      : monitorQueryKeys.taskDetail("__disabled__" as TaskId),
    queryFn: async () => {
      if (!taskId) {
        throw new Error("useTaskDetailQuery called without a taskId");
      }
      const [detail, timeline, turns] = await Promise.all([
        fetchTaskDetail(taskId),
        fetchTaskTimeline(taskId),
        fetchTaskTurns(taskId),
      ]);
      return {
        ...detail,
        timeline: timeline.timeline,
        olderCursor: timeline.olderCursor,
        turns: turns.turns,
      };
    },
    enabled: taskId !== null,
  });
}

export function useTaskChildrenQuery(taskId: TaskId | null): UseQueryResult<TaskChildrenResponse> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskChildren(taskId)
      : monitorQueryKeys.taskChildren("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskChildrenQuery called without a taskId");
      }
      return fetchTaskChildren(taskId);
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

export function useTaskUserInputsQuery(
  taskId: TaskId | null,
): UseQueryResult<readonly TaskUserInput[]> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskUserInputs(taskId)
      : monitorQueryKeys.taskUserInputs("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskUserInputsQuery called without a taskId");
      }
      return fetchTaskUserInputs(taskId);
    },
    enabled: Boolean(taskId),
  });
}

export function useTaskVerificationsQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<readonly TaskVerification[]> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskVerifications(taskId)
      : monitorQueryKeys.taskVerifications("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskVerificationsQuery called without a taskId");
      }
      return fetchTaskVerifications(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
  });
}
