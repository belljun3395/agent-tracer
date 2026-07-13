import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TaskId } from "~web/shared/identity.js";
import type { SearchResponse } from "~web/features/search/model/search.js";
import { fetchSearch } from "~web/features/search/api/api-search.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

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
