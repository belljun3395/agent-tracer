export {matchRecipes} from "@monitor/kernel/recipe/recipe.matching.js";
export type {
    RecipeMatchCandidate as CachedRecipe,
    RecipeMatch,
} from "@monitor/kernel/recipe/recipe.matching.js";

import type {RecipeMatch} from "@monitor/kernel/recipe/recipe.matching.js";
import {truncate} from "~runtime/support/text.js";

const SUMMARY_MAX = 600;

/** 매칭된 레시피를 에이전트가 읽는 컨텍스트 블록으로 만든다. */
export function formatRecipeContext(matches: readonly RecipeMatch[]): string {
    if (matches.length === 0) return "";
    const lines = [
        "<agent-tracer-recipes>",
        "Past patterns in this workspace that match this prompt (score 0..1):",
    ];
    for (const match of matches) {
        lines.push("");
        lines.push(`• ${match.title} (recipeId: ${match.recipeId}, score ${match.score.toFixed(2)})`);
        lines.push(`  intent: ${match.intent}`);
        lines.push(`  ${match.description}`);
        const summary = match.summaryMd.trim();
        if (summary.length === 0) continue;
        const compact = summary.length > SUMMARY_MAX ? `${truncate(summary, SUMMARY_MAX)}…` : summary;
        for (const line of compact.split("\n")) lines.push(`  ${line}`);
    }
    lines.push("</agent-tracer-recipes>");
    return lines.join("\n");
}
