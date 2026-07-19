import {RECIPE_OUTCOMES, type RecipeOutcome} from "@monitor/kernel/recipe/recipe.const.js";
import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 레시피 효과를 재는 유일한 되먹임이므로 설명 문구가 언제 불러야 하는지를 분명히 못박는다. */
export const REPORT_RECIPE_OUTCOME_TOOL: McpToolSpec = {
    name: "report_recipe_outcome",
    description:
        "Report whether a recipe you followed actually helped on this task. Call this once you can "
        + "judge the result — right after finishing the work the recipe guided, or as soon as you "
        + "abandon the recipe partway through because it did not fit. This is the only feedback signal "
        + "recipe effectiveness is measured by: call it every time you acted on a recipe, whether you "
        + "found it with search_recipes or it arrived in your context, even when the outcome was mixed "
        + "or negative.",
    inputSchema: {
        type: "object",
        properties: {
            recipeId: {
                type: "string",
                description: "The recipeId from a search_recipes result or from a recipe block in your context.",
            },
            outcome: {
                type: "string",
                enum: [...RECIPE_OUTCOMES],
                description:
                    "'completed' if the recipe helped you finish the task, 'abandoned' if you stopped "
                    + "following it because it did not help, 'superseded' if you found a better approach "
                    + "and replaced it.",
            },
            note: {type: "string", description: "Optional short note on what happened."},
        },
        required: ["recipeId", "outcome"],
    },
};

const OUTCOME_SET: ReadonlySet<string> = new Set(RECIPE_OUTCOMES);

export interface ReportRecipeOutcomeArgs {
    readonly recipeId: string;
    readonly outcome: RecipeOutcome;
    readonly note?: string;
}

export function parseReportRecipeOutcomeArgs(value: unknown): ReportRecipeOutcomeArgs | null {
    if (!isRecord(value)) return null;
    const recipeId = value["recipeId"];
    const outcome = value["outcome"];
    if (typeof recipeId !== "string" || recipeId.trim() === "") return null;
    if (typeof outcome !== "string" || !OUTCOME_SET.has(outcome)) return null;
    const note = value["note"];
    return {
        recipeId,
        outcome: outcome as RecipeOutcome,
        ...(typeof note === "string" && note.trim() !== "" ? {note} : {}),
    };
}
