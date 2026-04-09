import type { ReusableTaskSnapshot, TaskEvaluation, WorkflowSummary } from "@monitor/core";
import type { BookmarksResponse, BookmarkRecord, MonitoringTask, OverviewResponse, SearchResponse, TaskDetailResponse, TaskObservabilityResponse, TimelineEvent, TasksResponse } from "./types.js";
function normalizeBaseUrl(value: string | undefined): string {
    return value?.replace(/\/+$/g, "") ?? "";
}
const API_BASE = normalizeBaseUrl((import.meta.env.VITE_MONITOR_BASE_URL as string | undefined)
    ?? (import.meta.env.VITE_BADEN_BASE_URL as string | undefined)
    ?? (import.meta.env.DEV
        ? (import.meta.env.VITE_MONITOR_DEV_BASE_URL as string | undefined)
        : undefined));
const WS_BASE = normalizeBaseUrl((import.meta.env.VITE_MONITOR_WS_BASE_URL as string | undefined)
    ?? (import.meta.env.DEV
        ? (import.meta.env.VITE_MONITOR_DEV_WS_BASE_URL as string | undefined)
        : undefined));
function resolveWebSocketBaseUrl(): string {
    if (WS_BASE) {
        return WS_BASE;
    }
    if (API_BASE) {
        return API_BASE;
    }
    return window.location.origin;
}
async function getJson<T>(pathname: string): Promise<T> {
    const response = await fetch(`${API_BASE}${pathname}`);
    if (!response.ok) {
        const error = new Error(`Failed to load ${pathname}: ${response.status}`) as Error & {
            status?: number;
            pathname?: string;
        };
        error.status = response.status;
        error.pathname = pathname;
        throw error;
    }
    return (await response.json()) as T;
}
async function patchJson<T>(pathname: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${pathname}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!response.ok)
        throw new Error(`PATCH ${pathname}: ${response.status}`);
    return await response.json() as Promise<T>;
}
async function postJson<T>(pathname: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!response.ok)
        throw new Error(`POST ${pathname}: ${response.status}`);
    return await response.json() as Promise<T>;
}
async function deleteRequest(pathname: string): Promise<void> {
    const response = await fetch(`${API_BASE}${pathname}`, { method: "DELETE" });
    if (!response.ok)
        throw new Error(`DELETE ${pathname}: ${response.status}`);
}
async function deleteJson<T>(pathname: string): Promise<T> {
    const response = await fetch(`${API_BASE}${pathname}`, { method: "DELETE" });
    if (!response.ok)
        throw new Error(`DELETE ${pathname}: ${response.status}`);
    return await response.json() as Promise<T>;
}
export function fetchOverview(): Promise<OverviewResponse> {
    return getJson<OverviewResponse>("/api/overview");
}
export function fetchTasks(): Promise<TasksResponse> {
    return getJson<TasksResponse>("/api/tasks");
}
export function fetchDefaultWorkspace(): Promise<{
    workspacePath: string;
}> {
    return getJson<{
        workspacePath: string;
    }>("/api/default-workspace");
}
export function fetchTaskDetail(taskId: string): Promise<TaskDetailResponse> {
    return getJson<TaskDetailResponse>(`/api/tasks/${taskId}`);
}
export function fetchTaskObservability(taskId: string): Promise<TaskObservabilityResponse> {
    return getJson<TaskObservabilityResponse>(`/api/tasks/${taskId}/observability`);
}
export interface OpenInferenceTaskExport {
    readonly taskId: string;
    readonly runtimeSource?: string;
    readonly spans: readonly {
        readonly spanId: string;
        readonly parentSpanId?: string;
        readonly name: string;
        readonly kind: string;
        readonly startTime: string;
        readonly attributes: Record<string, unknown>;
    }[];
}
export function fetchTaskOpenInference(taskId: string): Promise<{
    openinference: OpenInferenceTaskExport;
}> {
    return getJson<{
        openinference: OpenInferenceTaskExport;
    }>(`/api/tasks/${taskId}/openinference`);
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
    const payload = await postJson<{
        bookmark: BookmarkRecord;
    }>("/api/bookmarks", input);
    return payload.bookmark;
}
export async function createMonitoredTask(input: {
    title: string;
    workspacePath?: string;
    runtimeSource?: string;
}): Promise<MonitoringTask> {
    const payload = await postJson<{
        task: MonitoringTask;
    }>("/api/task-start", input);
    return payload.task;
}
export async function updateTaskTitle(taskId: string, title: string): Promise<MonitoringTask> {
    const payload = await patchJson<{
        task: MonitoringTask;
    }>(`/api/tasks/${taskId}`, { title });
    return payload.task;
}
export async function updateTaskStatus(taskId: string, status: MonitoringTask["status"]): Promise<MonitoringTask> {
    const payload = await patchJson<{
        task: MonitoringTask;
    }>(`/api/tasks/${taskId}`, { status });
    return payload.task;
}
export async function updateEventDisplayTitle(eventId: string, displayTitle: string | null): Promise<TimelineEvent> {
    const payload = await patchJson<{
        event: TimelineEvent;
    }>(`/api/events/${eventId}`, { displayTitle });
    return payload.event;
}
export async function deleteTask(taskId: string): Promise<void> {
    return deleteRequest(`/api/tasks/${taskId}`);
}
export async function deleteBookmark(bookmarkId: string): Promise<void> {
    return deleteRequest(`/api/bookmarks/${bookmarkId}`);
}
export async function purgeFinishedTasks(): Promise<{
    deleted: number;
}> {
    return deleteJson<{
        deleted: number;
    }>("/api/tasks/finished");
}
export interface TaskEvaluationPayload {
    rating: "good" | "skip";
    useCase?: string;
    workflowTags?: string[];
    outcomeNote?: string;
    approachNote?: string;
    reuseWhen?: string;
    watchouts?: string;
    workflowSnapshot?: ReusableTaskSnapshot;
    workflowContext?: string;
}
export interface TaskEvaluationRecord extends TaskEvaluation {
    readonly workflowSnapshot: ReusableTaskSnapshot | null;
    readonly workflowContext: string | null;
    readonly searchText: string | null;
}
export type WorkflowSummaryRecord = WorkflowSummary;
export interface WorkflowContentRecord {
    readonly taskId: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workflowSnapshot: ReusableTaskSnapshot;
    readonly workflowContext: string;
    readonly searchText: string | null;
    readonly source: "saved" | "generated";
}
export function fetchWorkflowLibrary(rating?: "good" | "skip", query?: string, limit?: number): Promise<WorkflowSummaryRecord[]> {
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
    await postJson<{
        ok: boolean;
    }>(`/api/tasks/${taskId}/evaluate`, payload);
}
export interface RuleActionPayload {
    taskId: string;
    sessionId?: string;
    action: string;
    title?: string;
    body?: string;
    ruleId: string;
    severity: string;
    status: string;
    source?: string;
    policy?: "audit" | "warn" | "block" | "approval_required";
    outcome?: "observed" | "warned" | "blocked" | "approval_requested" | "approved" | "rejected" | "bypassed";
    metadata?: Record<string, unknown>;
}
export async function postRuleAction(payload: RuleActionPayload): Promise<void> {
    await postJson<{
        ok?: boolean;
    }>("/api/rule", payload);
}
export function fetchWorkflowContent(taskId: string): Promise<WorkflowContentRecord> {
    return getJson<WorkflowContentRecord>(`/api/workflows/${taskId}/content`);
}
export function createMonitorWebSocket(): WebSocket {
    const baseUrl = resolveWebSocketBaseUrl();
    const wsUrl = new URL(baseUrl.replace(/^http/, "ws"));
    wsUrl.pathname = "/ws";
    return new WebSocket(wsUrl);
}
