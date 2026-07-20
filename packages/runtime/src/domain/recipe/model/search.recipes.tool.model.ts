import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

/** 레시피를 고를 만큼만 보여주는 검색 도구이며, 설명 문구가 부를 시점과 다음 단계를 못박는다. */
export const SEARCH_RECIPES_TOOL: McpToolSpec = {
    name: "search_recipes",
    description:
        "Search this workspace's saved recipes — workflows distilled from how past tasks here were "
        + "actually solved. Call this before you start substantive work whenever the request plausibly "
        + "repeats something this workspace has handled before: a familiar setup, a migration, a "
        + "recurring fix, a multi-step workflow. Results carry only what you need to choose — id, "
        + "title, intent, description. They do not carry the steps, so call get_recipe(recipeId) once "
        + "you have picked one you intend to follow. Skip this for requests that are clearly one-off, "
        + "novel, or trivial. An empty result means nothing saved here fits; proceed on your own.",
    inputSchema: {
        type: "object",
        properties: {
            query: {type: "string", description: "The task you are about to do, in your own words."},
            limit: {type: "number", description: `Max recipes to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`},
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
    if (typeof limit !== "number" || !Number.isFinite(limit)) return {query: query.trim()};
    return {query: query.trim(), limit: Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)};
}
