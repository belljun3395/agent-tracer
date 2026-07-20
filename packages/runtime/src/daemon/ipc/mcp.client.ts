import type {RecipeOutcome} from "@monitor/kernel/recipe/recipe.const.js";
import {resolveClaudeSessionId} from "~runtime/config/env.js";
import {resolveAgentTracerPaths} from "~runtime/config/home.paths.js";
import {requestDaemon} from "~runtime/daemon/ipc/socket.client.js";
import {
    parseDaemonMemoCreateResponse,
    parseDaemonMemoSearchResponse,
    parseDaemonRecipeGetResponse,
    parseDaemonRecipeOutcomeResponse,
    parseDaemonRecipeScanResponse,
    parseDaemonSetTaskTitleResponse,
    type DaemonMemoCreateRequest,
    type DaemonMemoCreateResponse,
    type DaemonMemoSearchRequest,
    type DaemonMemoSearchResponse,
    type DaemonRecipeGetRequest,
    type DaemonRecipeGetResponse,
    type DaemonRecipeOutcomeRequest,
    type DaemonRecipeOutcomeResponse,
    type DaemonRecipeScanRequest,
    type DaemonRecipeScanResponse,
    type DaemonSetTaskTitleRequest,
    type DaemonSetTaskTitleResponse,
} from "~runtime/daemon/port/mcp.socket.port.js";

const REQUEST_TIMEOUT_MS = 3000;
const EMPTY_GET: DaemonRecipeGetResponse = {body: null};
const NO_DAEMON_OUTCOME: DaemonRecipeOutcomeResponse = {ok: false, reason: "daemon_unreachable"};
const NO_DAEMON_SCAN: DaemonRecipeScanResponse = {queued: false, reason: "daemon_unreachable"};
const NO_DAEMON_TITLE: DaemonSetTaskTitleResponse = {ok: false, reason: "daemon_unreachable"};
const NO_DAEMON_MEMO_CREATE: DaemonMemoCreateResponse = {ok: false, reason: "daemon_unreachable"};
const NO_DAEMON_MEMO_SEARCH: DaemonMemoSearchResponse = {items: [], reason: "daemon_unreachable"};
const UNKNOWN_SESSION = "unknown_session";

/** MCP 브리지가 데몬에 캐시된 레시피 본문 조회를 위임하며, 성공하면 데몬이 그 시점에 적용을 연다. */
export async function getRecipeViaDaemon(recipeId: string): Promise<DaemonRecipeGetResponse> {
    const sessionId = resolveClaudeSessionId();
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "recipe-get",
                recipeId,
                ...(sessionId !== undefined ? {sessionId} : {}),
            } satisfies DaemonRecipeGetRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonRecipeGetResponse(parsed) ?? EMPTY_GET,
            EMPTY_GET,
        );
    } catch {
        return EMPTY_GET;
    }
}

/** MCP report_recipe_outcome 도구가 데몬에 레시피 성과 보고를 위임한다. */
export async function reportRecipeOutcomeViaDaemon(
    recipeId: string,
    outcome: RecipeOutcome,
    note?: string,
): Promise<DaemonRecipeOutcomeResponse> {
    const sessionId = resolveClaudeSessionId();
    if (sessionId === undefined) return {ok: false, reason: UNKNOWN_SESSION};
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "recipe-outcome",
                recipeId,
                outcome,
                sessionId,
                ...(note !== undefined ? {note} : {}),
            } satisfies DaemonRecipeOutcomeRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonRecipeOutcomeResponse(parsed) ?? NO_DAEMON_OUTCOME,
            NO_DAEMON_OUTCOME,
        );
    } catch {
        return NO_DAEMON_OUTCOME;
    }
}

/** MCP request_recipe_scan 도구가 데몬에 레시피 스캔 큐잉을 위임한다. */
export async function requestRecipeScanViaDaemon(): Promise<DaemonRecipeScanResponse> {
    const sessionId = resolveClaudeSessionId();
    if (sessionId === undefined) return {queued: false, reason: UNKNOWN_SESSION};
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "recipe-scan-request", sessionId} satisfies DaemonRecipeScanRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonRecipeScanResponse(parsed) ?? NO_DAEMON_SCAN,
            NO_DAEMON_SCAN,
        );
    } catch {
        return NO_DAEMON_SCAN;
    }
}

/** MCP set_task_title 도구가 데몬에 재제목을 위임한다. */
export async function setTaskTitleViaDaemon(title: string, sessionId: string): Promise<DaemonSetTaskTitleResponse> {
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "set-task-title", title, sessionId} satisfies DaemonSetTaskTitleRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonSetTaskTitleResponse(parsed) ?? NO_DAEMON_TITLE,
            NO_DAEMON_TITLE,
        );
    } catch {
        return NO_DAEMON_TITLE;
    }
}

/** MCP create_memo 도구가 데몬에 메모 쓰기를 위임한다. */
export async function createMemoViaDaemon(body: string, eventId?: string): Promise<DaemonMemoCreateResponse> {
    const sessionId = resolveClaudeSessionId();
    if (sessionId === undefined) return {ok: false, reason: UNKNOWN_SESSION};
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "memo-create",
                body,
                sessionId,
                ...(eventId !== undefined ? {eventId} : {}),
            } satisfies DaemonMemoCreateRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonMemoCreateResponse(parsed) ?? NO_DAEMON_MEMO_CREATE,
            NO_DAEMON_MEMO_CREATE,
        );
    } catch {
        return NO_DAEMON_MEMO_CREATE;
    }
}

/** MCP search_memos 도구가 데몬에 메모 조회를 위임한다. */
export async function searchMemosViaDaemon(query?: string, limit?: number): Promise<DaemonMemoSearchResponse> {
    const sessionId = resolveClaudeSessionId();
    if (sessionId === undefined) return {items: [], reason: UNKNOWN_SESSION};
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "memo-search",
                sessionId,
                ...(query !== undefined ? {query} : {}),
                ...(limit !== undefined ? {limit} : {}),
            } satisfies DaemonMemoSearchRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonMemoSearchResponse(parsed) ?? NO_DAEMON_MEMO_SEARCH,
            NO_DAEMON_MEMO_SEARCH,
        );
    } catch {
        return NO_DAEMON_MEMO_SEARCH;
    }
}
