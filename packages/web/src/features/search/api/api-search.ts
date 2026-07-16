import type { TaskId } from "~web/shared/identity.js";
import type { SearchResponse } from "~web/features/search/model/search.js";
import { mergeSearchResults } from "~web/features/search/model/search.js";
import { getJson } from "~web/shared/api/client/json-methods.js";

export async function fetchSearch(
  searchType: "tasks" | "events",
  query: string,
  options?: { readonly taskId?: TaskId; readonly limit?: number },
): Promise<SearchResponse> {
  // 서버의 검색 스키마는 질의 텍스트를 "query"가 아니라 "q"로 받는다.
  const params = new URLSearchParams({ q: query });
  if (options?.taskId) params.set("taskId", options.taskId);
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  const qs = params.toString();
  // 선택된 히트 종류의 엔드포인트 하나만 호출하며, 메모 히트는 서버가 각 엔드포인트에 이미 접어 준다.
  if (searchType === "events") {
    const eventsRes = await getJson<{ readonly items: SearchResponse["events"] }>(
      `/api/v1/events/search?${qs}`,
    );
    return mergeSearchResults([], eventsRes.items);
  }
  const tasksRes = await getJson<{ readonly items: SearchResponse["tasks"] }>(
    `/api/v1/tasks/search?${qs}`,
  );
  return mergeSearchResults(tasksRes.items, []);
}
