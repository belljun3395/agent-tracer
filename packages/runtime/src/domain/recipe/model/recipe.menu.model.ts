const MENU_LIMIT = 20;

export interface RecipeMenuItem {
    readonly id: string;
    readonly title: string;
    readonly description: string;
}

/** 활성 레시피 전부를 메뉴로 조립하며, 본문은 요약하지 않고 목록 자체를 상한 아래로 자른다. */
export function buildRecipeMenu(recipes: readonly RecipeMenuItem[]): string {
    if (recipes.length === 0) return "";
    const shown = recipes.slice(0, MENU_LIMIT);
    const lines = [
        "<agent-tracer-recipes>",
        "Verified workflows from this workspace. If one fits, call get_recipe(recipeId) for its full "
            + "steps before starting.",
        "",
        ...shown.map((recipe) => `• ${recipe.id}: ${recipe.title} — ${recipe.description}`),
    ];
    const omitted = recipes.length - shown.length;
    if (omitted > 0) lines.push("", `…and ${omitted} more recipes not shown.`);
    lines.push("</agent-tracer-recipes>");
    return lines.join("\n");
}
