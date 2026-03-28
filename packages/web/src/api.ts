/**
 * @module api
 *
 * 대시보드 REST API + WebSocket 클라이언트.
 * 서버와의 모든 HTTP/WebSocket 통신을 담당.
 */

import type {
  BookmarksResponse,
  BookmarkRecord,
  MonitoringTask,
  OverviewResponse,
  SearchResponse,
  TaskEvaluation,
  TaskDetailResponse,
  TaskObservabilityResponse,
  TimelineEvent,
  TasksResponse,
  WorkflowSummary
} from "./types.js";

const API_BASE = (
  (import.meta.env.VITE_MONITOR_BASE_URL as string | undefined)
  ?? (import.meta.env.VITE_BADEN_BASE_URL as string | undefined)
)?.replace(/\/+$/g, "") ?? "";

async function getJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`);

  if (!response.ok) {
    throw new Error(`Failed to load ${pathname}: ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * JSON 본문으로 PATCH 요청 수행.
 * @throws 응답이 ok가 아닐 때 에러
 */
async function patchJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`PATCH ${pathname}: ${response.status}`);
  return await response.json() as Promise<T>;
}

async function postJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`POST ${pathname}: ${response.status}`);
  return await response.json() as Promise<T>;
}

/**
 * DELETE 요청 수행.
 * @throws 응답이 ok가 아닐 때 에러
 */
async function deleteRequest(pathname: string): Promise<void> {
  const response = await fetch(`${API_BASE}${pathname}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`DELETE ${pathname}: ${response.status}`);
}

/**
 * JSON 응답이 있는 DELETE 요청 수행.
 * @throws 응답이 ok가 아닐 때 에러
 */
async function deleteJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`DELETE ${pathname}: ${response.status}`);
  return await response.json() as Promise<T>;
}

/**
 * 대시보드 개요(통계 + observability snapshot)를 가져옴.
 */
export function fetchOverview(): Promise<OverviewResponse> {
  return getJson<OverviewResponse>("/api/overview");
}

/**
 * 모든 모니터링 태스크 목록을 가져옴.
 */
export function fetchTasks(): Promise<TasksResponse> {
  return getJson<TasksResponse>("/api/tasks");
}

/**
 * 특정 태스크의 상세 정보(타임라인 포함)를 가져옴.
 * @param taskId - 조회할 태스크 ID
 */
export function fetchTaskDetail(taskId: string): Promise<TaskDetailResponse> {
  return getJson<TaskDetailResponse>(`/api/tasks/${taskId}`);
}

export function fetchTaskObservability(taskId: string): Promise<TaskObservabilityResponse> {
  return getJson<TaskObservabilityResponse>(`/api/tasks/${taskId}/observability`);
}

export function fetchBookmarks(taskId?: string): Promise<BookmarksResponse> {
  const suffix = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
  return getJson<BookmarksResponse>(`/api/bookmarks${suffix}`);
}

export function fetchSearchResults(query: string, taskId?: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (taskId) {
    params.set("taskId", taskId);
  }
  return getJson<SearchResponse>(`/api/search?${params.toString()}`);
}

export async function createBookmark(input: {
  taskId: string;
  eventId?: string;
  title?: string;
  note?: string;
}): Promise<BookmarkRecord> {
  const payload = await postJson<{ bookmark: BookmarkRecord }>("/api/bookmarks", input);
  return payload.bookmark;
}

/**
 * 태스크 제목을 업데이트함.
 * @param taskId - 수정할 태스크 ID
 * @param title - 새 제목
 * @returns 업데이트된 태스크 객체
 */
export async function updateTaskTitle(taskId: string, title: string): Promise<MonitoringTask> {
  const payload = await patchJson<{ task: MonitoringTask }>(`/api/tasks/${taskId}`, { title });
  return payload.task;
}

/**
 * 태스크 상태를 업데이트함.
 * @param taskId - 수정할 태스크 ID
 * @param status - 새 상태
 * @returns 업데이트된 태스크 객체
 */
export async function updateTaskStatus(taskId: string, status: MonitoringTask["status"]): Promise<MonitoringTask> {
  const payload = await patchJson<{ task: MonitoringTask }>(`/api/tasks/${taskId}`, { status });
  return payload.task;
}

export async function updateEventDisplayTitle(
  eventId: string,
  displayTitle: string | null
): Promise<TimelineEvent> {
  const payload = await patchJson<{ event: TimelineEvent }>(`/api/events/${eventId}`, { displayTitle });
  return payload.event;
}

/**
 * 특정 태스크를 삭제함.
 * @param taskId - 삭제할 태스크 ID
 */
export async function deleteTask(taskId: string): Promise<void> {
  return deleteRequest(`/api/tasks/${taskId}`);
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  return deleteRequest(`/api/bookmarks/${bookmarkId}`);
}

/**
 * 완료된 모든 태스크를 일괄 삭제함.
 * @returns 삭제된 태스크 수
 */
export async function purgeFinishedTasks(): Promise<{ deleted: number }> {
  return deleteJson<{ deleted: number }>("/api/tasks/finished");
}

export interface TaskEvaluationPayload {
  rating: "good" | "skip";
  useCase?: string;
  workflowTags?: string[];
  outcomeNote?: string;
  approachNote?: string;
  reuseWhen?: string;
  watchouts?: string;
}

export type TaskEvaluationRecord = TaskEvaluation;

export type WorkflowSummaryRecord = WorkflowSummary;

export function fetchWorkflowLibrary(
  rating?: "good" | "skip",
  query?: string,
  limit?: number
): Promise<WorkflowSummaryRecord[]> {
  const params = new URLSearchParams();
  if (rating) {
    params.set("rating", rating);
  }
  if (query?.trim()) {
    params.set("q", query.trim());
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return getJson<WorkflowSummaryRecord[]>(`/api/workflows${suffix}`);
}

export function fetchTaskEvaluation(taskId: string): Promise<TaskEvaluationRecord | null> {
  return getJson<TaskEvaluationRecord | null>(`/api/tasks/${taskId}/evaluate`);
}

export async function saveTaskEvaluation(taskId: string, payload: TaskEvaluationPayload): Promise<void> {
  await postJson<{ ok: boolean }>(`/api/tasks/${taskId}/evaluate`, payload);
}

/**
 * 모니터 WebSocket 연결을 생성함.
 * 서버 이벤트 수신 시 대시보드 데이터를 갱신하는 데 사용.
 */
export function createMonitorWebSocket(): WebSocket {
  const baseUrl = API_BASE || window.location.origin;
  const wsUrl = new URL(baseUrl.replace(/^http/, "ws"));
  wsUrl.pathname = "/ws";

  return new WebSocket(wsUrl);
}
