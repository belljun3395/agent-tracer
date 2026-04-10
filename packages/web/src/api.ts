import type { BookmarkId, EventId, ReusableTaskSnapshot, RuleId, RuntimeSource, SessionId, TaskEvaluation, TaskId, WorkflowSummary, WorkspacePath } from "@monitor/core";
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
    workspacePath: WorkspacePath;
}> {
    return getJson<{
        workspacePath: WorkspacePath;
    }>("/api/default-workspace");
}
export function fetchTaskDetail(taskId: TaskId): Promise<TaskDetailResponse> {
    return getJson<TaskDetailResponse>(`/api/tasks/${taskId}`);
}
export function fetchTaskObservability(taskId: TaskId): Promise<TaskObservabilityResponse> {
    return getJson<TaskObservabilityResponse>(`/api/tasks/${taskId}/observability`);
}
export interface OpenInferenceTaskExport {
    readonly taskId: TaskId;
    readonly runtimeSource?: RuntimeSource;
    readonly spans: readonly {
        readonly spanId: EventId;
        readonly parentSpanId?: EventId;
        readonly name: string;
        readonly kind: string;
        readonly startTime: string;
        readonly attributes: Record<string, unknown>;
    }[];
}
export function fetchTaskOpenInference(taskId: TaskId): Promise<{
    openinference: OpenInferenceTaskExport;
}> {
    return getJson<{
        openinference: OpenInferenceTaskExport;
    }>(`/api/tasks/${taskId}/openinference`);
}
export function fetchBookmarks(taskId?: TaskId): Promise<BookmarksResponse> {
    const suffix = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
    return getJson<BookmarksResponse>(`/api/bookmarks${suffix}`);
}
export function fetchSearchResults(query: string, taskId?: TaskId): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (taskId) {
        params.set("taskId", taskId);
    }
    return getJson<SearchResponse>(`/api/search?${params.toString()}`);
}
export async function createBookmark(input: {
    taskId: TaskId;
    eventId?: EventId;
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
    workspacePath?: WorkspacePath;
    runtimeSource?: RuntimeSource;
}): Promise<MonitoringTask> {
    const payload = await postJson<{
        task: MonitoringTask;
    }>("/api/task-start", input);
    return payload.task;
}
export async function updateTaskTitle(taskId: TaskId, title: string): Promise<MonitoringTask> {
    const payload = await patchJson<{
        task: MonitoringTask;
    }>(`/api/tasks/${taskId}`, { title });
    return payload.task;
}
export async function updateTaskStatus(taskId: TaskId, status: MonitoringTask["status"]): Promise<MonitoringTask> {
    const payload = await patchJson<{
        task: MonitoringTask;
    }>(`/api/tasks/${taskId}`, { status });
    return payload.task;
}
export async function updateEventDisplayTitle(eventId: EventId, displayTitle: string | null): Promise<TimelineEvent> {
    const payload = await patchJson<{
        event: TimelineEvent;
    }>(`/api/events/${eventId}`, { displayTitle });
    return payload.event;
}
export async function deleteTask(taskId: TaskId): Promise<void> {
    return deleteRequest(`/api/tasks/${taskId}`);
}
export async function deleteBookmark(bookmarkId: BookmarkId): Promise<void> {
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
    readonly taskId: TaskId;
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
export function fetchTaskEvaluation(taskId: TaskId): Promise<TaskEvaluationRecord | null> {
    return getJson<TaskEvaluationRecord | null>(`/api/tasks/${taskId}/evaluate`);
}
export async function saveTaskEvaluation(taskId: TaskId, payload: TaskEvaluationPayload): Promise<void> {
    await postJson<{
        ok: boolean;
    }>(`/api/tasks/${taskId}/evaluate`, payload);
}
export interface RuleActionPayload {
    taskId: TaskId;
    sessionId?: SessionId;
    action: string;
    title?: string;
    body?: string;
    ruleId: RuleId;
    severity: string;
    status: string;
    source?: string;
    policy?: "audit" | "warn" | "block" | "approval_required";
    outcome?: "observed" | "warned" | "blocked" | "approval_requested" | "approved" | "rejected" | "bypassed";
    metadata?: Record<string, unknown>;
}
export async function postRuleAction(payload: RuleActionPayload): Promise<void> {
    await postJson<{ ok?: boolean }>("/ingest/v1/events", {
        events: [{
            kind: "rule.logged",
            taskId: payload.taskId,
            ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
            action: payload.action,
            ...(payload.title ? { title: payload.title } : {}),
            ...(payload.body ? { body: payload.body } : {}),
            ruleId: payload.ruleId,
            severity: payload.severity,
            status: payload.status,
            ...(payload.source ? { source: payload.source } : {}),
            ...(payload.policy ? { policy: payload.policy } : {}),
            ...(payload.outcome ? { outcome: payload.outcome } : {}),
            ...(payload.metadata ? { metadata: payload.metadata } : {}),
        }],
    });
}
export function fetchWorkflowContent(taskId: TaskId): Promise<WorkflowContentRecord> {
    return getJson<WorkflowContentRecord>(`/api/workflows/${taskId}/content`);
}
export function createMonitorWebSocket(): WebSocket {
    const baseUrl = resolveWebSocketBaseUrl();
    const wsUrl = new URL(baseUrl.replace(/^http/, "ws"));
    wsUrl.pathname = "/ws";
    return new WebSocket(wsUrl);
}
