import { useMemo } from "react";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TagId, TaskId } from "~web/shared/identity.js";
import type { TagsListResponse, TasksByTagRecord, TaskTagsRecord } from "~web/entities/tag/model/tag.js";
import {
  fetchTags,
  fetchTasksByTag,
  fetchTaskTags,
} from "~web/entities/tag/api/api-tags.js";
import { intersectTaskIdSets } from "~web/entities/tag/lib/intersect-task-ids.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useTagsQuery(): UseQueryResult<TagsListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.tags(),
    queryFn: fetchTags,
  });
}

export function useTaskTagsQuery(
  taskId: TaskId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<TaskTagsRecord> {
  return useQuery({
    queryKey: taskId
      ? monitorQueryKeys.taskTags(taskId)
      : monitorQueryKeys.taskTags("__disabled__" as TaskId),
    queryFn: () => {
      if (!taskId) {
        throw new Error("useTaskTagsQuery called without a taskId");
      }
      return fetchTaskTags(taskId);
    },
    enabled: taskId !== null && (options?.enabled ?? true),
  });
}

export function useTasksByTagQuery(
  tagId: TagId | null,
  options?: { readonly enabled?: boolean },
): UseQueryResult<TasksByTagRecord> {
  return useQuery({
    queryKey: tagId
      ? monitorQueryKeys.tasksByTag(tagId)
      : monitorQueryKeys.tasksByTag("__disabled__"),
    queryFn: () => {
      if (!tagId) {
        throw new Error("useTasksByTagQuery called without a tagId");
      }
      return fetchTasksByTag(tagId);
    },
    enabled: tagId !== null && (options?.enabled ?? true),
  });
}

export interface TaskIdsForTagsResult {
  /** null이면 태그 필터가 걸려 있지 않다는 뜻이다. */
  readonly taskIds: ReadonlySet<TaskId> | null;
  readonly isLoading: boolean;
}

/** GitHub 라벨 필터처럼 선택된 태그를 모두 가진 태스크 id 집합을 구한다. */
export function useTaskIdsForTagsQuery(tagIds: readonly TagId[]): TaskIdsForTagsResult {
  const results = useQueries({
    queries: tagIds.map((tagId) => ({
      queryKey: monitorQueryKeys.tasksByTag(tagId),
      queryFn: () => fetchTasksByTag(tagId),
    })),
  });

  return useMemo(() => {
    if (tagIds.length === 0) return { taskIds: null, isLoading: false };
    const isLoading = results.some((result) => result.data === undefined);
    if (isLoading) return { taskIds: new Set<TaskId>(), isLoading: true };
    const sets = results.map((result) => new Set(result.data?.taskIds ?? []));
    return { taskIds: intersectTaskIdSets(sets), isLoading: false };
  }, [tagIds, results]);
}
