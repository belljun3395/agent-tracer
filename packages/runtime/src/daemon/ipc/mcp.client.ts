import type {RecipeOutcome} from "@monitor/kernel/recipe/recipe.const.js";
import {resolveAgentTracerPaths} from "~runtime/config/home.paths.js";
import {requestDaemon} from "~runtime/daemon/ipc/socket.client.js";
import {
    parseDaemonMemoCreateResponse,
    parseDaemonMemoSearchResponse,
    parseDaemonRecipeOutcomeResponse,
    parseDaemonRecipeScanResponse,
    parseDaemonRecipeSearchResponse,
    parseDaemonSetTaskTitleResponse,
    type DaemonMemoCreateRequest,
    type DaemonMemoCreateResponse,
    type DaemonMemoSearchRequest,
    type DaemonMemoSearchResponse,
    type DaemonRecipeOutcomeRequest,
    type DaemonRecipeOutcomeResponse,
    type DaemonRecipeScanRequest,
    type DaemonRecipeScanResponse,
    type DaemonRecipeSearchRequest,
    type DaemonRecipeSearchResponse,
    type DaemonSetTaskTitleRequest,
    type DaemonSetTaskTitleResponse,
} from "~runtime/daemon/port/mcp.socket.port.js";

const REQUEST_TIMEOUT_MS = 3000;
const EMPTY_SEARCH: DaemonRecipeSearchResponse = {matches: []};
const NO_DAEMON_OUTCOME: DaemonRecipeOutcomeResponse = {ok: false, reason: "daemon_unreachable"};
const NO_DAEMON_SCAN: DaemonRecipeScanResponse = {queued: false, reason: "daemon_unreachable"};
const NO_DAEMON_TITLE: DaemonSetTaskTitleResponse = {ok: false, reason: "daemon_unreachable"};
const NO_DAEMON_MEMO_CREATE: DaemonMemoCreateResponse = {ok: false, reason: "daemon_unreachable"};
const NO_DAEMON_MEMO_SEARCH: DaemonMemoSearchResponse = {items: [], reason: "daemon_unreachable"};

/** MCP 브리지가 데몬에 캐시된 레시피 검색을 위임한다. */
export async function searchRecipesViaDaemon(query: string, limit?: number): Promise<DaemonRecipeSearchResponse> {
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "recipe-search",
                query,
                ...(limit !== undefined ? {limit} : {}),
            } satisfies DaemonRecipeSearchRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonRecipeSearchResponse(parsed) ?? EMPTY_SEARCH,
            EMPTY_SEARCH,
        );
    } catch {
        return EMPTY_SEARCH;
    }
}

/** MCP report_recipe_outcome 도구가 데몬에 레시피 성과 보고를 위임한다. */
export async function reportRecipeOutcomeViaDaemon(
    recipeId: string,
    outcome: RecipeOutcome,
    note?: string,
): Promise<DaemonRecipeOutcomeResponse> {
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "recipe-outcome",
                recipeId,
                outcome,
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
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "recipe-scan-request"} satisfies DaemonRecipeScanRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonRecipeScanResponse(parsed) ?? NO_DAEMON_SCAN,
            NO_DAEMON_SCAN,
        );
    } catch {
        return NO_DAEMON_SCAN;
    }
}

/** MCP set_task_title 도구가 데몬에 재제목을 위임한다. */
export async function setTaskTitleViaDaemon(title: string): Promise<DaemonSetTaskTitleResponse> {
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "set-task-title", title} satisfies DaemonSetTaskTitleRequest,
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
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "memo-create",
                body,
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
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "memo-search",
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
