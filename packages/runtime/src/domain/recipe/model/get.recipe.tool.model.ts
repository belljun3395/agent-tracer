import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 메뉴에서 본 레시피의 전체 워크플로우를 가져오는 도구이며 설명 문구가 실제로 반환되는 것만 약속한다. */
export const GET_RECIPE_TOOL: McpToolSpec = {
    name: "get_recipe",
    description:
        "Fetch the full workflow for a recipe you saw in the <agent-tracer-recipes> menu — its intent, "
        + "the recorded steps in order, known pitfalls, past corrections, touched files, and governing "
        + "rules. Call this before you start work whenever a recipe in the menu plausibly fits the "
        + "current task. Calling this marks the recipe as applied to this task, so only call it for a "
        + "recipe you intend to actually follow.",
    inputSchema: {
        type: "object",
        properties: {
            recipeId: {type: "string", description: "The recipeId from a recipe entry in the menu."},
        },
        required: ["recipeId"],
    },
};

export interface GetRecipeArgs {
    readonly recipeId: string;
}

export function parseGetRecipeArgs(value: unknown): GetRecipeArgs | null {
    if (!isRecord(value)) return null;
    const recipeId = value["recipeId"];
    return typeof recipeId === "string" && recipeId.trim() !== "" ? {recipeId} : null;
}
