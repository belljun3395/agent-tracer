import type { MonitoringTask, TaskId } from "~domain/monitoring.js";
import type { TaskOpenInferenceResponse } from "~domain/openinference.js";
import type {
  RuleCreateInput,
  RuleRecord,
  RuleUpdateInput,
  RulesListResponse,
  TaskRulesResponse,
} from "~domain/rule.js";
import type { SearchResponse } from "~domain/search-contracts.js";
import type {
  TaskDetailResponse,
  TasksResponse,
} from "~domain/task-query-contracts.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(value: string | undefined): string {
  return value?.replace(/\/+$/g, "") ?? "";
}

const API_BASE = normalizeBaseUrl(
  (import.meta.env.VITE_MONITOR_BASE_URL as string | undefined) ??
    (import.meta.env.DEV
      ? (import.meta.env.VITE_MONITOR_DEV_BASE_URL as string | undefined)
      : undefined),
);

const WS_BASE = normalizeBaseUrl(
  (import.meta.env.VITE_MONITOR_WS_BASE_URL as string | undefined) ??
    (import.meta.env.DEV
      ? (import.meta.env.VITE_MONITOR_DEV_WS_BASE_URL as string | undefined)
      : undefined),
);

function resolveWebSocketBaseUrl(): string {
  if (WS_BASE) return WS_BASE;
  if (API_BASE) return API_BASE;
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
    return { signal: null, cleanup: () => undefined };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const abortFromExternal = (): void => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(
        new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"),
      );
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
    },
  };
}

async function request(
  pathname: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<Response> {
  const { signal, cleanup } = createRequestSignal(options);
  const requestInit: RequestInit = {
    credentials: "include",
    ...init,
    ...(signal ? { signal } : {}),
  };
  try {
    return await fetch(`${API_BASE}${pathname}`, requestInit);
  } catch (error) {
    if (
      signal?.aborted &&
      signal.reason instanceof DOMException &&
      signal.reason.name === "TimeoutError"
    ) {
      throw new Error(`Request timed out for ${pathname}`);
    }
    throw error;
  } finally {
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

async function deleteRequest<T>(
  pathname: string,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(pathname, { method: "DELETE" }, options);
  if (!response.ok) {
    throw await createResponseError(response, pathname, "DELETE");
  }
  // The server returns `{ deleted: true }` directly (no envelope), but
  // unwrapApiEnvelope handles both shapes safely.
  return unwrapApiEnvelope<T>(await response.json());
}

async function postJson<T>(
  pathname: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(
    pathname,
    {
      method: "POST",
      headers:
        body !== undefined ? { "content-type": "application/json" } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    options,
  );
  if (!response.ok) {
    throw await createResponseError(response, pathname, "POST");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

async function patchJson<T>(
  pathname: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(
    pathname,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    options,
  );
  if (!response.ok) {
    throw await createResponseError(response, pathname, "PATCH");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

async function createResponseError(
  response: Response,
  pathname: string,
  method: string,
): Promise<Error> {
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
    return (await response.json()) as unknown;
  } catch {
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
  return (
    isRecord(body) &&
    body["ok"] === false &&
    isRecord(body["error"]) &&
    typeof body["error"]["code"] === "string" &&
    typeof body["error"]["message"] === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── public surface ────────────────────────────────────────────────────

export function fetchTasks(): Promise<TasksResponse> {
  return getJson<TasksResponse>("/api/v1/tasks");
}

export function fetchTaskDetail(taskId: TaskId): Promise<TaskDetailResponse> {
  return getJson<TaskDetailResponse>(`/api/v1/tasks/${taskId}`);
}

export function fetchTaskOpenInference(
  taskId: TaskId,
): Promise<TaskOpenInferenceResponse> {
  return getJson<TaskOpenInferenceResponse>(
    `/api/v1/tasks/${taskId}/openinference`,
  );
}

export function fetchRules(): Promise<RulesListResponse> {
  return getJson<RulesListResponse>("/api/v1/rules");
}

export function fetchTaskRules(taskId: TaskId): Promise<TaskRulesResponse> {
  return getJson<TaskRulesResponse>(`/api/v1/tasks/${taskId}/rules`);
}

export interface DeleteTaskResponse {
  readonly deleted: boolean;
}

export function deleteTask(taskId: TaskId): Promise<DeleteTaskResponse> {
  return deleteRequest<DeleteTaskResponse>(`/api/v1/tasks/${taskId}`);
}

export interface UpdateTaskBody {
  readonly title?: string;
  readonly status?: "running" | "waiting" | "completed" | "errored";
}

export interface UpdateTaskResponse {
  readonly task: MonitoringTask;
}

export function updateTask(
  taskId: TaskId,
  body: UpdateTaskBody,
): Promise<UpdateTaskResponse> {
  return patchJson<UpdateTaskResponse>(`/api/v1/tasks/${taskId}`, body);
}

export interface DeleteRuleResponse {
  readonly deleted: boolean;
}

export function deleteRule(ruleId: string): Promise<DeleteRuleResponse> {
  return deleteRequest<DeleteRuleResponse>(`/api/v1/rules/${ruleId}`);
}

export function createRule(body: RuleCreateInput): Promise<RuleRecord> {
  return postJson<RuleRecord>("/api/v1/rules", body);
}

export function updateRule(
  ruleId: string,
  body: RuleUpdateInput,
): Promise<RuleRecord> {
  return patchJson<RuleRecord>(`/api/v1/rules/${ruleId}`, body);
}

export function promoteRule(ruleId: string): Promise<unknown> {
  return postJson<unknown>(`/api/v1/rules/${ruleId}/promote`);
}

export function reEvaluateRule(
  ruleId: string,
  body?: { readonly taskId?: TaskId },
): Promise<unknown> {
  return postJson<unknown>(`/api/v1/rules/${ruleId}/re-evaluate`, body);
}

export function fetchSearch(
  query: string,
  options?: { readonly taskId?: TaskId; readonly limit?: number },
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query });
  if (options?.taskId) params.set("taskId", options.taskId);
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  return getJson<SearchResponse>(`/api/v1/search?${params.toString()}`);
}

export function getMonitorWsUrl(): string {
  const baseUrl = resolveWebSocketBaseUrl();
  const wsUrl = new URL(baseUrl.replace(/^http/, "ws"));
  wsUrl.pathname = "/ws";
  return wsUrl.toString();
}
