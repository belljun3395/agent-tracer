import {RECIPE_OUTCOMES, type RecipeOutcome} from "@monitor/kernel/recipe/recipe.const.js";
import type {RecipeMatch} from "~runtime/domain/recipe/model/recipe.model.js";
import {isRecord} from "~runtime/support/json.js";

/** MCP 브리지가 데몬에 위임하는 도구 호출 전용 소켓 메시지이며 daemon.socket.port가 이 계약을 얹어 쓴다. */

/** MCP search_recipes 도구가 데몬에 묻는 캐시 검색 요청이다. */
export interface DaemonRecipeSearchRequest {
    readonly type: "recipe-search";
    readonly query: string;
    readonly limit?: number;
}

/** MCP report_recipe_outcome 도구가 데몬에 보고하는 레시피 성과이며 taskId는 데몬이 활성 바인딩으로 채운다. */
export interface DaemonRecipeOutcomeRequest {
    readonly type: "recipe-outcome";
    readonly recipeId: string;
    readonly outcome: RecipeOutcome;
    readonly note?: string;
}

/** MCP request_recipe_scan 도구가 데몬에 넣는 스캔 요청이며 taskId는 데몬이 활성 바인딩으로 채운다. */
export interface DaemonRecipeScanRequest {
    readonly type: "recipe-scan-request";
}

/** MCP set_task_title 도구가 보내는 재제목 요청이며 taskId는 데몬이 활성 바인딩으로 채운다. */
export interface DaemonSetTaskTitleRequest {
    readonly type: "set-task-title";
    readonly title: string;
}

export type McpSocketRequest =
    | DaemonRecipeSearchRequest
    | DaemonRecipeOutcomeRequest
    | DaemonRecipeScanRequest
    | DaemonSetTaskTitleRequest;

export interface DaemonRecipeSearchResponse {
    readonly matches: readonly RecipeMatch[];
}

/** 활성 태스크를 못 찾았거나 서버가 거절하면 ok가 false이고 reason에 이유가 담긴다. */
export interface DaemonRecipeOutcomeResponse {
    readonly ok: boolean;
    readonly reason?: string;
}

/** 활성 태스크를 못 찾았거나 서버가 거절하면 queued가 false이고 reason에 이유가 담긴다. */
export interface DaemonRecipeScanResponse {
    readonly queued: boolean;
    readonly reason?: string;
}

/** 활성 태스크를 못 찾았거나 서버가 거절하면 ok가 false이고 reason에 이유가 담긴다. */
export interface DaemonSetTaskTitleResponse {
    readonly ok: boolean;
    readonly reason?: string;
}

export type McpSocketResponse =
    | DaemonRecipeSearchResponse
    | DaemonRecipeOutcomeResponse
    | DaemonRecipeScanResponse
    | DaemonSetTaskTitleResponse;

/** daemon.socket.port의 parseDaemonRequest가 자기 타입을 못 찾을 때 넘기는 자리다. */
export function parseMcpSocketRequest(type: string, value: Record<string, unknown>): McpSocketRequest | null {
    switch (type) {
        case "recipe-search":
            return typeof value["query"] === "string"
                ? {
                    type: "recipe-search",
                    query: value["query"],
                    ...(typeof value["limit"] === "number" ? {limit: value["limit"]} : {}),
                }
                : null;
        case "recipe-outcome":
            return typeof value["recipeId"] === "string"
                && typeof value["outcome"] === "string"
                && (RECIPE_OUTCOMES as readonly string[]).includes(value["outcome"])
                ? {
                    type: "recipe-outcome",
                    recipeId: value["recipeId"],
                    outcome: value["outcome"] as RecipeOutcome,
                    ...(typeof value["note"] === "string" ? {note: value["note"]} : {}),
                }
                : null;
        case "recipe-scan-request":
            return {type: "recipe-scan-request"};
        case "set-task-title":
            return typeof value["title"] === "string"
                ? {type: "set-task-title", title: value["title"]}
                : null;
        default:
            return null;
    }
}

export function parseDaemonRecipeSearchResponse(value: unknown): DaemonRecipeSearchResponse | null {
    return isRecord(value) && Array.isArray(value["matches"])
        ? {matches: value["matches"] as RecipeMatch[]}
        : null;
}

export function parseDaemonRecipeOutcomeResponse(value: unknown): DaemonRecipeOutcomeResponse | null {
    if (!isRecord(value) || typeof value["ok"] !== "boolean") return null;
    return {
        ok: value["ok"],
        ...(typeof value["reason"] === "string" ? {reason: value["reason"]} : {}),
    };
}

export function parseDaemonRecipeScanResponse(value: unknown): DaemonRecipeScanResponse | null {
    if (!isRecord(value) || typeof value["queued"] !== "boolean") return null;
    return {
        queued: value["queued"],
        ...(typeof value["reason"] === "string" ? {reason: value["reason"]} : {}),
    };
}

export function parseDaemonSetTaskTitleResponse(value: unknown): DaemonSetTaskTitleResponse | null {
    if (!isRecord(value) || typeof value["ok"] !== "boolean") return null;
    return {
        ok: value["ok"],
        ...(typeof value["reason"] === "string" ? {reason: value["reason"]} : {}),
    };
}
