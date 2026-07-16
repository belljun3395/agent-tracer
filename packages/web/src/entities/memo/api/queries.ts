import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { EventId, TaskId } from "~web/shared/identity.js";
import type { MemosListResponse } from "~web/entities/memo/model/memo.js";
import {
  fetchEventMemos,
  fetchMemos,
  fetchTaskMemos,
} from "~web/entities/memo/api/api-memos.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useMemosQuery(): UseQueryResult<MemosListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.memos(),
    queryFn: fetchMemos,
  });
}

export function useTaskMemosQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<MemosListResponse> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskMemos(taskId)
      : monitorQueryKeys.taskMemos("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskMemosQuery called without a taskId");
      }
      return fetchTaskMemos(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
  });
}

export function useEventMemosQuery(
  taskId: TaskId | null,
  eventId: EventId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<MemosListResponse> {
  return useQuery({
    queryKey:
      taskId && eventId
        ? monitorQueryKeys.eventMemos(taskId, eventId)
        : monitorQueryKeys.eventMemos("__disabled__" as TaskId, "__disabled__"),
    queryFn: () => {
      if (!taskId || !eventId) {
        throw new Error("useEventMemosQuery called without taskId/eventId");
      }
      return fetchEventMemos(taskId, eventId);
    },
    enabled: taskId !== null && eventId !== null && (options?.enabled ?? true),
  });
}
