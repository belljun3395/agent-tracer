import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

/** 레시피 하나를 전문 텍스트로 조립하며, 에이전트가 명시적으로 요청했을 때만 오므로 절단하지 않는다. */
export function buildRecipeBody(recipe: CachedRecipe): string {
    const lines = [`# ${recipe.title}`, "", `intent: ${recipe.intent}`, recipe.description];

    const summary = recipe.summaryMd.trim();
    if (summary) lines.push("", summary);

    if (recipe.steps.length > 0) {
        lines.push("", "## Steps");
        for (const step of [...recipe.steps].sort((left, right) => left.order - right.order)) {
            const rationale = step.rationale ? ` (${step.rationale})` : "";
            lines.push(`${step.order}. ${step.action}${rationale}`);
        }
    }

    if (recipe.pitfalls.length > 0) {
        lines.push("", "## Pitfalls");
        for (const pitfall of recipe.pitfalls) lines.push(`- ${pitfall.pitfall} — ${pitfall.whyNonObvious}`);
    }

    if (recipe.corrections.length > 0) {
        lines.push("", "## Corrections");
        for (const correction of recipe.corrections) {
            lines.push(`- ${correction.whatAgentDid} → ${correction.howCorrected}`);
        }
    }

    if (recipe.touchedFiles.length > 0) lines.push("", `touched files: ${recipe.touchedFiles.join(", ")}`);
    if (recipe.governingRules.length > 0) lines.push("", `governing rules: ${recipe.governingRules.join(", ")}`);

    return lines.join("\n");
}
