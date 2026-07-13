import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchTaskCleanupSuggestions } from "~web/entities/task-cleanup/api/api-task-cleanup.js";
import type { CleanupSuggestionsResponse } from "~web/entities/task-cleanup/model/task-cleanup.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useTaskCleanupSuggestionsQuery(
  status: "pending" | "all" = "pending",
): UseQueryResult<CleanupSuggestionsResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.taskCleanupSuggestions(status),
    queryFn: () => fetchTaskCleanupSuggestions(status),
  });
}
