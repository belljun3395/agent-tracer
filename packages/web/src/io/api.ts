import type {
    EventId,
    RuleId,
    RuntimeSource,
    SessionId,
    TaskId,
} from "../types.js";
import type {
    MonitoringTask,
    OverviewResponse,
    SearchResponse,
    TaskDetailResponse,
    TimelineEventRecord,
    TasksResponse
} from "../types.js";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

function normalizeBaseUrl(value: string | undefined): string {
    return value?.replace(/\/+$/g, "") ?? "";
}
const API_BASE = normalizeBaseUrl((import.meta.env.VITE_MONITOR_BASE_URL as string | undefined)
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

interface ApiSuccessEnvelope<T> {
    readonly ok: true;
    readonly data: T;
}

interface ApiErrorEnvelope {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
    };
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
        throw await createResponseError(response, pathname, "GET");
    }
    return unwrapApiEnvelope<T>(await response.json());
}
async function patchJson<T>(pathname: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }, options);
    if (!response.ok) throw await createResponseError(response, pathname, "PATCH");
    return unwrapApiEnvelope<T>(await response.json());
}
async function postJson<T>(pathname: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }, options);
    if (!response.ok) throw await createResponseError(response, pathname, "POST");
    return unwrapApiEnvelope<T>(await response.json());
}
async function deleteRequest(pathname: string, options?: RequestOptions): Promise<void> {
    const response = await request(pathname, { method: "DELETE" }, options);
    if (!response.ok) throw await createResponseError(response, pathname, "DELETE");
}
async function putJson<T>(pathname: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await request(pathname, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }, options);
    if (!response.ok) throw await createResponseError(response, pathname, "PUT");
    return unwrapApiEnvelope<T>(await response.json());
}

async function createResponseError(response: Response, pathname: string, method: string): Promise<Error> {
    const body = await readJsonBody(response);
    const envelope = isApiErrorEnvelope(body) ? body : undefined;
    const message = envelope?.error.message ?? `${method} ${pathname}: ${response.status}`;
    const error = new Error(message) as Error & {
        status?: number;
        pathname?: string;
        code?: string;
        details?: unknown;
    };
    error.status = response.status;
    error.pathname = pathname;
    if (envelope) {
        error.code = envelope.error.code;
        error.details = envelope.error.details;
    }
    return error;
}

async function readJsonBody(response: Response): Promise<unknown> {
    try {
        return await response.json() as unknown;
    }
    catch {
        return undefined;
    }
}

function unwrapApiEnvelope<T>(body: unknown): T {
    if (isApiSuccessEnvelope<T>(body)) return body.data;
    return body as T;
}

function isApiSuccessEnvelope<T>(body: unknown): body is ApiSuccessEnvelope<T> {
    return isRecord(body) && body["ok"] === true && "data" in body;
}

function isApiErrorEnvelope(body: unknown): body is ApiErrorEnvelope {
    return isRecord(body)
        && body["ok"] === false
        && isRecord(body["error"])
        && typeof body["error"]["code"] === "string"
        && typeof body["error"]["message"] === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function fetchOverview(): Promise<OverviewResponse> {
    return getJson<OverviewResponse>("/api/v1/overview");
}
export function fetchTasks(): Promise<TasksResponse> {
    return getJson<TasksResponse>("/api/v1/tasks");
}
export function fetchTaskDetail(taskId: TaskId): Promise<TaskDetailResponse> {
    return getJson<TaskDetailResponse>(`/api/v1/tasks/${taskId}`);
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
    }>(`/api/v1/tasks/${taskId}/openinference`);
}
export function fetchSearchResults(query: string, taskId?: TaskId, options?: RequestOptions): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (taskId) {
        params.set("taskId", taskId);
    }
    return getJson<SearchResponse>(`/api/v1/search?${params.toString()}`, options);
}
export async function updateTaskTitle(taskId: TaskId, title: string): Promise<MonitoringTask> {
    const payload = await patchJson<{
        task: MonitoringTask;
    }>(`/api/v1/tasks/${taskId}`, { title });
    return payload.task;
}
export async function updateTaskStatus(taskId: TaskId, status: MonitoringTask["status"]): Promise<MonitoringTask> {
    const payload = await patchJson<{
        task: MonitoringTask;
    }>(`/api/v1/tasks/${taskId}`, { status });
    return payload.task;
}
export async function updateEventDisplayTitle(eventId: EventId, displayTitle: string | null): Promise<TimelineEventRecord> {
    const payload = await patchJson<{
        event: TimelineEventRecord;
    }>(`/api/v1/events/${eventId}`, { displayTitle });
    return payload.event;
}
export async function deleteTask(taskId: TaskId): Promise<void> {
    return deleteRequest(`/api/v1/tasks/${taskId}`);
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
    await postJson<{ ok?: boolean }>("/api/v1/events", {
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
    return getJson<TurnPartitionRecord>(`/api/v1/tasks/${taskId}/turn-partition`);
}
export function saveTurnPartition(taskId: TaskId, payload: TurnPartitionUpsertPayload): Promise<TurnPartitionRecord> {
    return putJson<TurnPartitionRecord>(`/api/v1/tasks/${taskId}/turn-partition`, payload);
}
export async function resetTurnPartition(taskId: TaskId): Promise<void> {
    await postJson<{ ok: boolean }>(`/api/v1/tasks/${taskId}/turn-partition/reset`, {});
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
