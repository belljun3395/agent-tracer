import { useInfiniteQuery, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  TasksArchivedScope,
  TasksOriginFilter,
  TasksResponse,
  TasksStatusFilter,
} from "~web/entities/task/model/task-query.js";
import {
  fetchScanAnchorTasks,
  fetchTasks,
  fetchTasksPage,
} from "~web/entities/task/api/list.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useTasksQuery(archived: TasksArchivedScope = "active"): UseQueryResult<TasksResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.tasks(archived),
    queryFn: () => fetchTasks(archived),
  });
}

export function useScanAnchorTasksQuery(includeArchived: boolean): UseQueryResult<TasksResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.scanAnchorTasks(includeArchived),
    queryFn: () => fetchScanAnchorTasks(includeArchived),
  });
}

export function useTaskPagesQuery(
  options: {
    readonly archived?: TasksArchivedScope;
    readonly origin?: TasksOriginFilter;
    readonly status?: TasksStatusFilter;
    readonly limit?: number;
  } = {},
) {
  const archived = options.archived ?? "active";
  const origin = options.origin ?? "all";
  const status = options.status ?? "all";
  const limit = options.limit ?? 100;
  return useInfiniteQuery({
    queryKey: monitorQueryKeys.taskPages(archived, origin, status, limit),
    queryFn: ({ pageParam }) =>
      fetchTasksPage({
        archived,
        origin,
        status,
        limit,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.page?.hasMore ? (lastPage.page.nextCursor ?? null) : null,
  });
}
