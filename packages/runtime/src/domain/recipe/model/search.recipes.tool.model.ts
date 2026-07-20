import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 워크스페이스 레시피를 질의어로 찾는 도구이며 결정 수준 정보만 돌려준다는 것을 설명에 못박는다. */
export const SEARCH_RECIPES_TOOL: McpToolSpec = {
    name: "search_recipes",
    description:
        "Search this workspace's saved recipes — workflows distilled from how past tasks here were "
        + "actually solved — by describing the current task in your own words. Returns decision-level "
        + "info only (recipeId, title, intent, description, relevance score), not the steps, pitfalls, "
        + "or corrections. Call this before starting work whenever the request plausibly repeats "
        + "something already solved here. If a result looks like a fit, call get_recipe(recipeId) next "
        + "to pull its full workflow before you act on it.",
    inputSchema: {
        type: "object",
        properties: {
            query: {type: "string", description: "The current task described in your own words."},
            limit: {type: "number", description: "Max recipes to return (default 3)."},
        },
        required: ["query"],
    },
};

export interface SearchRecipesArgs {
    readonly query: string;
    readonly limit?: number;
}

export function parseSearchRecipesArgs(value: unknown): SearchRecipesArgs | null {
    if (!isRecord(value)) return null;
    const query = value["query"];
    if (typeof query !== "string" || query.trim() === "") return null;
    const limit = value["limit"];
    return {
        query,
        ...(typeof limit === "number" && Number.isFinite(limit) ? {limit} : {}),
    };
}
