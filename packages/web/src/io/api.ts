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

// ── 멀티유저 신원 ──────────────────────────────────────────────────────
// 최초 사용 시 이메일로 온보딩해 받은 userId 를 보관하고, 이후 모든 요청에
// X-User-Id 헤더로 실어 보낸다.
const USER_ID_STORAGE_KEY = "monitor.userId";

function readStoredUserId(): string | null {
  try {
    return window.localStorage.getItem(USER_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

let currentUserId: string | null = readStoredUserId();

export function getUserId(): string | null {
  return currentUserId;
}

export function setUserId(userId: string): void {
  currentUserId = userId;
  try {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  } catch {
    // 저장 실패해도 메모리 값으로 이번 세션은 동작한다.
  }
}

export interface OnboardingResult {
  readonly userId: string;
  readonly email: string;
}

/** 이메일로 온보딩하고 받은 userId 를 보관한다. */
export async function onboardUser(email: string): Promise<OnboardingResult> {
  const result = await postJson<OnboardingResult>("/api/v1/users/onboarding", {
    email,
  });
  setUserId(result.userId);
  return result;
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

/**
 * Errors thrown by `getJson` / `postJson` / etc. carry the HTTP status and
 * the server's envelope `code` so callers can branch on "the row really
 * isn't there" (404 / `not_found`) versus "the monitor server is down or
 * unreachable" (network failure / 5xx).
 */
export interface ApiRequestError extends Error {
  status?: number;
  pathname?: string;
  code?: string;
  details?: unknown;
}

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const e = error as ApiRequestError;
  return e.status === 404 || e.code === "not_found";
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
  const headers = new Headers(init?.headers);
  if (currentUserId) headers.set("X-User-Id", currentUserId);
  const requestInit: RequestInit = {
    credentials: "include",
    ...init,
    headers,
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

export type TasksArchivedScope = "active" | "archived" | "all";

export function fetchTasks(
  archived: TasksArchivedScope = "active",
): Promise<TasksResponse> {
  const qs = archived === "active" ? "" : `?archived=${archived}`;
  return getJson<TasksResponse>(`/api/v1/tasks${qs}`);
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
  return getJson<TaskRulesResponse>(`/api/v1/rules/for-task?taskId=${taskId}`);
}

export type RuleMatchedBy =
  | "action"
  | "commandMatch"
  | "pattern"
  | "trigger-phrase";

export interface RuleEvidenceEvent {
  readonly eventId: string;
  readonly kind: string;
  readonly title: string;
  readonly body?: string;
  readonly command?: string;
  readonly filePath?: string;
  readonly toolName?: string;
  readonly decidedAt: string;
  readonly createdAt: string;
  readonly matchKind: "trigger" | "expect-fulfilled";
  readonly matchedBy: readonly RuleMatchedBy[];
  readonly unfulfilled?: boolean;
}

export interface RuleEvidenceResponse {
  readonly taskId: string;
  readonly ruleId: string;
  readonly triggers: readonly RuleEvidenceEvent[];
  readonly expects: readonly RuleEvidenceEvent[];
}

export function demoteRule(
  ruleId: string,
  taskId: TaskId,
): Promise<unknown> {
  return postJson<unknown>(`/api/v1/rules/${ruleId}/demote`, { taskId });
}

export function fetchRuleEvidence(
  taskId: TaskId,
  ruleId: string,
): Promise<RuleEvidenceResponse> {
  return getJson<RuleEvidenceResponse>(
    `/api/v1/rules/${encodeURIComponent(ruleId)}/evidence?taskId=${taskId}`,
  );
}

export interface DeleteTaskResponse {
  readonly deleted: boolean;
}

export function deleteTask(taskId: TaskId): Promise<DeleteTaskResponse> {
  return deleteRequest<DeleteTaskResponse>(`/api/v1/tasks/${taskId}`);
}

export interface ArchiveTaskResponse {
  readonly archived: boolean;
  readonly archivedIds: readonly TaskId[];
  readonly archivedAt: string;
}

export interface UnarchiveTaskResponse {
  readonly unarchived: boolean;
  readonly unarchivedIds: readonly TaskId[];
}

export function archiveTask(taskId: TaskId): Promise<ArchiveTaskResponse> {
  return postJson<ArchiveTaskResponse>(`/api/v1/tasks/${taskId}/archive`);
}

export function unarchiveTask(taskId: TaskId): Promise<UnarchiveTaskResponse> {
  return deleteRequest<UnarchiveTaskResponse>(
    `/api/v1/tasks/${taskId}/archive`,
  );
}

export interface TitleSuggestion {
  readonly title: string;
  readonly rationale: string;
}

export interface SuggestTitleResponse {
  readonly suggestions: readonly TitleSuggestion[];
  readonly modelUsed?: string;
  readonly durationMs?: number;
}

export function suggestTaskTitle(
  taskId: TaskId,
): Promise<SuggestTitleResponse> {
  return postJson<SuggestTitleResponse>(
    `/api/v1/tasks/${taskId}/suggest-title`,
  );
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

export async function fetchSearch(
  query: string,
  options?: { readonly taskId?: TaskId; readonly limit?: number },
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query });
  if (options?.taskId) params.set("taskId", options.taskId);
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  const qs = params.toString();
  // Fan out to the two context-owned endpoints (timeline events + work tasks)
  // and merge. Each context searches only its own table, so timeline stays a
  // leaf; the web is the edge that combines for display. Event hits' taskTitle
  // is filled from the matched tasks when available (else left blank).
  const [eventsRes, tasksRes] = await Promise.all([
    getJson<{ readonly events: SearchResponse["events"] }>(`/api/v1/events/search?${qs}`),
    getJson<{ readonly tasks: SearchResponse["tasks"] }>(`/api/v1/tasks/search?${qs}`),
  ]);
  const titleByTaskId = new Map(tasksRes.tasks.map((t) => [t.taskId, t.title] as const));
  const events = eventsRes.events.map((e) =>
    e.taskTitle ? e : { ...e, taskTitle: titleByTaskId.get(e.taskId) ?? "" },
  );
  return { tasks: tasksRes.tasks, events };
}

export interface GenerateRulesJobResponse {
  readonly jobId: string;
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly taskId: string;
  readonly createdAt: string;
}

export interface GenerateRulesJobStatus {
  readonly id: string;
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly attempts: number;
  readonly error: string | null;
  readonly rulesCreated: number;
  readonly modelUsed: string | null;
  readonly durationMs: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export function enqueueGenerateRules(
  taskId: TaskId,
): Promise<GenerateRulesJobResponse> {
  return postJson<GenerateRulesJobResponse>(
    `/api/v1/rules/generate?taskId=${taskId}`,
  );
}

export function fetchLatestGenerateRulesJob(
  taskId: TaskId,
): Promise<{ job: GenerateRulesJobStatus | null }> {
  return getJson<{ job: GenerateRulesJobStatus | null }>(
    `/api/v1/rules/generate/latest?taskId=${taskId}`,
  );
}

export type CleanupSuggestionKind =
  | "archive"
  | "rename_title"
  | "set_parent"
  | "reslug";

export type CleanupSuggestionStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "failed";

export interface CleanupSuggestion {
  readonly id: string;
  readonly jobId: string;
  readonly taskId: TaskId;
  readonly kind: CleanupSuggestionKind;
  readonly currentValue: unknown;
  readonly proposedValue: unknown;
  readonly rationale: string;
  readonly status: CleanupSuggestionStatus;
  readonly error?: string;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

export interface CleanupSuggestionsResponse {
  readonly suggestions: readonly CleanupSuggestion[];
}

export interface TaskCleanupJobStatus {
  readonly id: string;
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly attempts: number;
  readonly error: string | null;
  readonly suggestionsCreated: number;
  readonly tasksScanned: number;
  readonly modelUsed: string | null;
  readonly durationMs: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface TaskCleanupJobEnqueueResponse {
  readonly jobId: string;
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly createdAt: string;
}

export function enqueueTaskCleanupScan(): Promise<TaskCleanupJobEnqueueResponse> {
  return postJson<TaskCleanupJobEnqueueResponse>(
    `/api/v1/task-cleanup/jobs`,
  );
}

export function fetchLatestTaskCleanupJob(): Promise<{
  job: TaskCleanupJobStatus | null;
}> {
  return getJson<{ job: TaskCleanupJobStatus | null }>(
    `/api/v1/task-cleanup/jobs/latest`,
  );
}

export function fetchTaskCleanupSuggestions(
  status: "pending" | "all" = "pending",
): Promise<CleanupSuggestionsResponse> {
  return getJson<CleanupSuggestionsResponse>(
    `/api/v1/task-cleanup/suggestions?status=${status}`,
  );
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

// ─── Recipes ────────────────────────────────────────────────────────────────

export type RecipeFileRole = "read" | "write" | "both";

export interface RecipeStep {
  readonly order: number;
  readonly action: string;
  readonly rationale?: string;
}

export interface RecipeTouchedFile {
  readonly path: string;
  readonly role: RecipeFileRole;
}

export interface RecipeSlice {
  readonly taskId: TaskId;
  readonly eventIds: readonly string[];
}

export type RecipeCandidateStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "failed";

export interface RecipeCandidate {
  readonly id: string;
  readonly jobId: string;
  readonly title: string;
  readonly intent: string;
  readonly description: string;
  readonly summaryMd: string;
  readonly steps: readonly RecipeStep[];
  readonly touchedFiles: readonly RecipeTouchedFile[];
  readonly contributingSlices: readonly RecipeSlice[];
  readonly rationale: string;
  readonly language: string | null;
  readonly parentRecipeId: string | null;
  readonly status: RecipeCandidateStatus;
  readonly error: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface RecipeCandidatesResponse {
  readonly candidates: readonly RecipeCandidate[];
}

export type RecipeStatus = "active" | "superseded" | "retired";

export interface Recipe {
  readonly id: string;
  readonly sourceCandidateId: string | null;
  readonly title: string;
  readonly intent: string;
  readonly description: string;
  readonly summaryMd: string;
  readonly steps: readonly RecipeStep[];
  readonly touchedFiles: readonly RecipeTouchedFile[];
  readonly contributingSlices: readonly RecipeSlice[];
  readonly rev: number;
  readonly parentRecipeId: string | null;
  readonly status: RecipeStatus;
  readonly appliedCount: number;
  readonly successCount: number;
  readonly language: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecipesResponse {
  readonly recipes: readonly Recipe[];
}

export interface RecipeScanJobStatus {
  readonly id: string;
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly attempts: number;
  readonly error: string | null;
  readonly candidatesCreated: number;
  readonly tasksScanned: number;
  readonly language: string | null;
  readonly modelUsed: string | null;
  readonly durationMs: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface RecipeScanEnqueueInput {
  readonly statusFilter?: "completed" | "active" | "all";
  readonly since?: string;
  readonly maxCandidates?: number;
  readonly minEventCount?: number;
  readonly archivedScope?: "active" | "archived" | "all";
}

export interface RecipeScanEnqueueResponse {
  readonly jobId: string;
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly createdAt: string;
}

export function enqueueRecipeScan(
  input: RecipeScanEnqueueInput = {},
): Promise<RecipeScanEnqueueResponse> {
  return postJson<RecipeScanEnqueueResponse>(`/api/v1/recipes/scan`, input);
}

export function fetchLatestRecipeScanJob(): Promise<{
  job: RecipeScanJobStatus | null;
}> {
  return getJson<{ job: RecipeScanJobStatus | null }>(
    `/api/v1/recipes/scan/jobs/latest`,
  );
}

export function fetchRecipeCandidates(
  status: "pending" | "all" = "pending",
): Promise<RecipeCandidatesResponse> {
  return getJson<RecipeCandidatesResponse>(
    `/api/v1/recipes/candidates?status=${status}`,
  );
}

export function acceptRecipeCandidate(
  candidateId: string,
): Promise<{ status: string; recipeId?: string }> {
  return postJson<{ status: string; recipeId?: string }>(
    `/api/v1/recipes/candidates/${encodeURIComponent(candidateId)}/accept`,
  );
}

export function dismissRecipeCandidate(
  candidateId: string,
): Promise<{ status: string }> {
  return postJson<{ status: string }>(
    `/api/v1/recipes/candidates/${encodeURIComponent(candidateId)}/dismiss`,
  );
}

export function fetchRecipes(
  status: "active" | "superseded" | "retired" | "all" = "active",
): Promise<RecipesResponse> {
  return getJson<RecipesResponse>(`/api/v1/recipes?status=${status}`);
}

export function retireRecipe(
  recipeId: string,
): Promise<{ status: string }> {
  return deleteRequest<{ status: string }>(
    `/api/v1/recipes/${encodeURIComponent(recipeId)}`,
  );
}

export interface AppSettingItem {
  readonly key: string;
  readonly maskedValue: string;
  readonly hasValue: true;
  readonly updatedAt: string;
}

export interface AppSettingsListResponse {
  readonly settings: readonly AppSettingItem[];
}

export interface AppSettingUpsertResponse {
  readonly setting: AppSettingItem;
}

export function fetchAppSettings(): Promise<AppSettingsListResponse> {
  return getJson<AppSettingsListResponse>("/api/v1/settings");
}

export function putAppSetting(
  key: string,
  value: string,
): Promise<AppSettingUpsertResponse> {
  return patchPut<AppSettingUpsertResponse>(
    `/api/v1/settings/${encodeURIComponent(key)}`,
    { value },
  );
}

export function deleteAppSetting(
  key: string,
): Promise<{ readonly deleted: boolean; readonly key: string }> {
  return deleteRequest<{ readonly deleted: boolean; readonly key: string }>(
    `/api/v1/settings/${encodeURIComponent(key)}`,
  );
}

async function patchPut<T>(
  pathname: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(
    pathname,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    options,
  );
  if (!response.ok) {
    throw await createResponseError(response, pathname, "PUT");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

export function getMonitorWsUrl(): string {
  const baseUrl = resolveWebSocketBaseUrl();
  const wsUrl = new URL(baseUrl.replace(/^http/, "ws"));
  wsUrl.pathname = "/ws";
  // 브라우저 WS 는 커스텀 헤더를 못 보내므로 userId 를 쿼리로 전달한다.
  if (currentUserId) wsUrl.searchParams.set("userId", currentUserId);
  return wsUrl.toString();
}
