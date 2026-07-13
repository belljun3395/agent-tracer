import type { CleanupSuggestionDto } from "@monitor/kernel";
import type { CleanupSuggestionsResponse } from "~web/entities/task-cleanup/model/task-cleanup.js";
import { getJson, postJson } from "~web/shared/api/client/json-methods.js";
import { toCleanupSuggestion } from "~web/entities/task-cleanup/api/task-cleanup.mapper.js";

export async function fetchTaskCleanupSuggestions(
  status: "pending" | "all" = "pending",
): Promise<CleanupSuggestionsResponse> {
  const query = status === "all" ? "" : `?status=${status}`;
  const response = await getJson<{ readonly items: readonly CleanupSuggestionDto[] }>(
    `/api/v1/task-cleanup/suggestions${query}`,
  );
  return { suggestions: response.items.map(toCleanupSuggestion) };
}

export function acceptTaskCleanupSuggestion(
  suggestionId: string,
): Promise<{ status: string }> {
  return postJson<{ status: string }>(
    `/api/v1/task-cleanup/suggestions/${encodeURIComponent(suggestionId)}/accept`,
  );
}

export function dismissTaskCleanupSuggestion(
  suggestionId: string,
): Promise<{ status: string }> {
  return postJson<{ status: string }>(
    `/api/v1/task-cleanup/suggestions/${encodeURIComponent(suggestionId)}/dismiss`,
  );
}
