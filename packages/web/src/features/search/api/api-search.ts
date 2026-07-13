import type { TaskId } from "~web/shared/identity.js";
import type { SearchResponse } from "~web/features/search/model/search.js";
import { mergeSearchResults } from "~web/features/search/model/search.js";
import { getJson } from "~web/shared/api/client/json-methods.js";

export async function fetchSearch(
  query: string,
  options?: { readonly taskId?: TaskId; readonly limit?: number },
): Promise<SearchResponse> {
  // 서버의 검색 스키마는 질의 텍스트를 "query"가 아니라 "q"로 받는다.
  const params = new URLSearchParams({ q: query });
  if (options?.taskId) params.set("taskId", options.taskId);
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  const qs = params.toString();
  // 컨텍스트가 각각 소유한 두 엔드포인트(timeline events + work tasks)에 병렬로 요청하고 병합한다.
  const [eventsRes, tasksRes] = await Promise.all([
    getJson<{ readonly items: SearchResponse["events"] }>(`/api/v1/events/search?${qs}`),
    getJson<{ readonly items: SearchResponse["tasks"] }>(`/api/v1/tasks/search?${qs}`),
  ]);
  return mergeSearchResults(tasksRes.items, eventsRes.items);
}
