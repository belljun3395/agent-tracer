import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 에이전트가 스스로 판단해 부르는 레시피 검색 도구이며 설명 문구가 호출 시점을 정한다. */
export const SEARCH_RECIPES_TOOL: McpToolSpec = {
    name: "search_recipes",
    description:
        "Search this workspace's saved task recipes — reusable workflows distilled from how past "
        + "tasks here were actually solved. Call this BEFORE you start substantive work whenever the "
        + "user's request plausibly repeats a pattern this workspace has handled before: a familiar "
        + "setup, migration, recurring fix, or multi-step workflow. Matches come back with their full "
        + "guidance already included (intent, description, and the recorded steps), so one search is "
        + "usually enough to act on without a follow-up lookup. Skip this for requests that are clearly "
        + "one-off, novel, or trivial.",
    inputSchema: {
        type: "object",
        properties: {
            query: {type: "string", description: "The user's request or task, in your own words."},
            limit: {type: "number", description: "Max recipes to return (default 3, max 10)."},
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
