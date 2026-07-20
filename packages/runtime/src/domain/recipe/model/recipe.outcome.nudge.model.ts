/** 아직 보고되지 않은 레시피가 있는 태스크만 겨누는 넛지다. */
export function formatRecipeOutcomeNudge(recipeId: string): string {
    return [
        "<agent-tracer-recipe-outcome>",
        `You opened recipe ${recipeId} and have not reported how it went.`,
        "Call `report_recipe_outcome` now — it is the only signal recipe quality is judged by.",
        "</agent-tracer-recipe-outcome>",
    ].join("\n");
}
