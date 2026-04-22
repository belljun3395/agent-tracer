import type {
    BookmarkId,
    EventId,
    PlaybookRecord,
    PlaybookStatus,
    PlaybookSummary,
    ReusableTaskSnapshot,
    RuleCommandRecord,
    RuleId,
    RuntimeSource,
    SavedBriefing,
    SessionId,
    TaskEvaluation,
    TaskId,
    WorkflowSearchResult,
    WorkflowSummary
} from "../types.js";
import type {
    BookmarksResponse,
    BookmarkRecord,
    MonitoringTask,
    OverviewResponse,
    SearchResponse,
    TaskDetailResponse,
    TaskObservabilityResponse,
    TimelineEventRecord,
    TasksResponse
} from "../types.js";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

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
interface RequestOptions {
    readonly signal?: AbortSignal;
    readonly timeoutMs?: number;
}

function createRequestSignal(options?: RequestOptions): {
    readonly signal: AbortSignal | null;
    readonly cleanup: () => void;
} {
    const externalSignal = options?.signal;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!externalSignal && timeoutMs <= 0) {
        return {
            signal: null,
            cleanup: () => {
                void 0;
            }
        };
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const abortFromExternal = (): void => {
        controller.abort(externalSignal?.reason);
    };

    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort(externalSignal.reason);
        }
        else {
            externalSignal.addEventListener("abort", abortFromExternal, { once: true });
        }
    }

    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"));
        }, timeoutMs);
    }

    return {
        signal: controller.signal,
        cleanup: () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            if (externalSignal) {
                externalSignal.removeEventListener("abort", abortFromExternal);
            }
        }
    };
}

async function request(pathname: string, init?: RequestInit, options?: RequestOptions): Promise<Response> {
    const { signal, cleanup } = createRequestSignal(options);
    const requestInit: RequestInit = {
        credentials: "include",
        ...init,
        ...(signal ? { signal } : {})
    };
    try {
        return await fetch(`${API_BASE}${pathname}`, requestInit);
    }
    catch (error) {
        if (signal?.aborted && signal.reason instanceof DOMException && signal.reason.name === "TimeoutError") {
            throw new Error(`Request timed out for ${pathname}`);
        }
        throw error;
    }
    finally {
        cleanup();
    }
}

async function getJson<T>(pathname: string, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, undefined, options);
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
async function patchJson<T>(pathname: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }, options);
    if (!response.ok)
        throw new Error(`PATCH ${pathname}: ${response.status}`);
    return await response.json() as Promise<T>;
}
async function postJson<T>(pathname: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }, options);
    if (!response.ok)
        throw new Error(`POST ${pathname}: ${response.status}`);
    return await response.json() as Promise<T>;
}
async function deleteRequest(pathname: string, options?: RequestOptions): Promise<void> {
    const response = await request(pathname, { method: "DELETE" }, options);
    if (!response.ok)
        throw new Error(`DELETE ${pathname}: ${response.status}`);
}
async function putJson<T>(pathname: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }, options);
    if (!response.ok)
        throw new Error(`PUT ${pathname}: ${response.status}`);
    return await response.json() as Promise<T>;
}
export function fetchOverview(): Promise<OverviewResponse> {
    return getJson<OverviewResponse>("/api/overview");
}
export function fetchTasks(): Promise<TasksResponse> {
    return getJson<TasksResponse>("/api/tasks");
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
export function fetchSearchResults(query: string, taskId?: TaskId, options?: RequestOptions): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (taskId) {
        params.set("taskId", taskId);
    }
    return getJson<SearchResponse>(`/api/search?${params.toString()}`, options);
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
export async function updateEventDisplayTitle(eventId: EventId, displayTitle: string | null): Promise<TimelineEventRecord> {
    const payload = await patchJson<{
        event: TimelineEventRecord;
    }>(`/api/events/${eventId}`, { displayTitle });
    return payload.event;
}
export async function deleteTask(taskId: TaskId): Promise<void> {
    return deleteRequest(`/api/tasks/${taskId}`);
}
export async function deleteBookmark(bookmarkId: BookmarkId): Promise<void> {
    return deleteRequest(`/api/bookmarks/${bookmarkId}`);
}
export function fetchGlobalRuleCommands(): Promise<{ ruleCommands: RuleCommandRecord[] }> {
    return getJson<{ ruleCommands: RuleCommandRecord[] }>("/api/rule-commands");
}
export function fetchTaskRuleCommands(taskId: TaskId): Promise<{ ruleCommands: RuleCommandRecord[] }> {
    return getJson<{ ruleCommands: RuleCommandRecord[] }>(`/api/tasks/${taskId}/rule-commands`);
}
export function createGlobalRuleCommand(pattern: string, label: string): Promise<{ ruleCommand: RuleCommandRecord }> {
    return postJson<{ ruleCommand: RuleCommandRecord }>("/api/rule-commands", { pattern, label });
}
export function createTaskRuleCommand(taskId: TaskId, pattern: string, label: string): Promise<{ ruleCommand: RuleCommandRecord }> {
    return postJson<{ ruleCommand: RuleCommandRecord }>(`/api/tasks/${taskId}/rule-commands`, { pattern, label });
}
export async function deleteRuleCommandById(id: string): Promise<void> {
    return deleteRequest(`/api/rule-commands/${id}`);
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
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: WorkflowSummary["qualitySignals"];
}
export type WorkflowSummaryRecord = WorkflowSummary;
export type WorkflowSearchResultRecord = WorkflowSearchResult;
export type PlaybookSummaryRecord = PlaybookSummary;
export type PlaybookRecordResponse = PlaybookRecord;
export type SavedBriefingRecord = SavedBriefing;
export interface WorkflowContentRecord {
    readonly snapshotId: string;
    readonly taskId: TaskId;
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workflowSnapshot: ReusableTaskSnapshot;
    readonly workflowContext: string;
    readonly searchText: string | null;
    readonly source: "saved" | "generated";
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: WorkflowSummary["qualitySignals"];
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
export function fetchTaskEvaluation(taskId: TaskId, scopeKey?: string): Promise<TaskEvaluationRecord | null> {
    const suffix = scopeKey ? `?scopeKey=${encodeURIComponent(scopeKey)}` : "";
    return getJson<TaskEvaluationRecord | null>(`/api/tasks/${taskId}/evaluate${suffix}`);
}
export async function recordBriefingCopy(taskId: TaskId, scopeKey?: string): Promise<void> {
    const suffix = scopeKey ? `?scopeKey=${encodeURIComponent(scopeKey)}` : "";
    await postJson<{ ok: boolean }>(`/api/tasks/${taskId}/briefing/copied${suffix}`, {});
}
export interface SaveBriefingPayload {
    purpose: SavedBriefing["purpose"];
    format: SavedBriefing["format"];
    memo?: string;
    content: string;
    generatedAt: string;
}
export function saveTaskBriefing(taskId: TaskId, payload: SaveBriefingPayload): Promise<SavedBriefingRecord> {
    return postJson<SavedBriefingRecord>(`/api/tasks/${taskId}/briefings`, payload);
}
export function fetchTaskBriefings(taskId: TaskId): Promise<SavedBriefingRecord[]> {
    return getJson<SavedBriefingRecord[]>(`/api/tasks/${taskId}/briefings`);
}
export async function saveTaskEvaluation(taskId: TaskId, payload: TaskEvaluationPayload, scopeKey?: string): Promise<void> {
    const suffix = scopeKey ? `?scopeKey=${encodeURIComponent(scopeKey)}` : "";
    await postJson<{
        ok: boolean;
    }>(`/api/tasks/${taskId}/evaluate${suffix}`, payload);
}
export function fetchSimilarWorkflows(query: string, tags?: readonly string[], limit?: number): Promise<WorkflowSearchResultRecord[]> {
    const params = new URLSearchParams({ q: query });
    if (tags && tags.length > 0) {
        params.set("tags", tags.join(","));
    }
    if (typeof limit === "number") {
        params.set("limit", String(limit));
    }
    return getJson<WorkflowSearchResultRecord[]>(`/api/workflows/similar?${params.toString()}`);
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
export function fetchWorkflowContent(taskId: TaskId, scopeKey?: string): Promise<WorkflowContentRecord> {
    const suffix = scopeKey ? `?scopeKey=${encodeURIComponent(scopeKey)}` : "";
    return getJson<WorkflowContentRecord>(`/api/workflows/${taskId}/content${suffix}`);
}
export interface PlaybookPayload {
    title: string;
    status?: PlaybookStatus;
    whenToUse?: string | null;
    prerequisites?: string[];
    approach?: string | null;
    keySteps?: string[];
    watchouts?: string[];
    antiPatterns?: string[];
    failureModes?: string[];
    variants?: PlaybookRecord["variants"];
    relatedPlaybookIds?: string[];
    sourceSnapshotIds?: string[];
    tags?: string[];
}
export function fetchPlaybooks(query?: string, status?: PlaybookStatus, limit?: number): Promise<PlaybookSummaryRecord[]> {
    const params = new URLSearchParams();
    if (query?.trim()) {
        params.set("q", query.trim());
    }
    if (status) {
        params.set("status", status);
    }
    if (typeof limit === "number") {
        params.set("limit", String(limit));
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return getJson<PlaybookSummaryRecord[]>(`/api/playbooks${suffix}`);
}
export function fetchPlaybook(playbookId: string): Promise<PlaybookRecordResponse> {
    return getJson<PlaybookRecordResponse>(`/api/playbooks/${playbookId}`);
}
export function createPlaybook(payload: PlaybookPayload): Promise<PlaybookRecordResponse> {
    return postJson<PlaybookRecordResponse>("/api/playbooks", payload);
}
export function updatePlaybook(playbookId: string, payload: Partial<PlaybookPayload>): Promise<PlaybookRecordResponse> {
    return postJson<PlaybookRecordResponse>(`/api/playbooks/${playbookId}`, payload);
}
export interface TurnPartitionRecord {
    readonly taskId: TaskId;
    readonly groups: ReadonlyArray<{
        readonly id: string;
        readonly from: number;
        readonly to: number;
        readonly label: string | null;
        readonly visible: boolean;
    }>;
    readonly version: number;
    readonly updatedAt: string;
}
export interface TurnPartitionUpsertPayload {
    readonly groups: ReadonlyArray<{
        readonly id: string;
        readonly from: number;
        readonly to: number;
        readonly label?: string | null;
        readonly visible: boolean;
    }>;
    readonly baseVersion?: number;
}
export function fetchTurnPartition(taskId: TaskId): Promise<TurnPartitionRecord> {
    return getJson<TurnPartitionRecord>(`/api/tasks/${taskId}/turn-partition`);
}
export function saveTurnPartition(taskId: TaskId, payload: TurnPartitionUpsertPayload): Promise<TurnPartitionRecord> {
    return putJson<TurnPartitionRecord>(`/api/tasks/${taskId}/turn-partition`, payload);
}
export async function resetTurnPartition(taskId: TaskId): Promise<void> {
    await postJson<{ ok: boolean }>(`/api/tasks/${taskId}/turn-partition/reset`, {});
}
export function getMonitorWsUrl(): string {
    const baseUrl = resolveWebSocketBaseUrl();
    const wsUrl = new URL(baseUrl.replace(/^http/, "ws"));
    wsUrl.pathname = "/ws";
    return wsUrl.toString();
}
export function createMonitorWebSocket(): WebSocket {
    return new WebSocket(getMonitorWsUrl());
}
