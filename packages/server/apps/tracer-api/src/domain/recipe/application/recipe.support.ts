import type { RecipeApplicationEntity, RecipeEntity } from "@monitor/tracer-domain";
import type { RecipeApplicationDto, RecipeDto, RecipeWithStatsDto } from "@monitor/kernel";

export type { RecipeApplicationDto, RecipeDto, RecipeWithStatsDto };

export function mapRecipe(recipe: RecipeEntity): RecipeDto {
    return {
        id: recipe.id,
        userId: recipe.userId,
        status: recipe.status,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        summaryMd: recipe.summaryMd,
        request: recipe.request,
        corrections: recipe.corrections as RecipeDto["corrections"],
        pitfalls: recipe.pitfalls as RecipeDto["pitfalls"],
        governingRules: recipe.governingRules,
        steps: recipe.steps,
        touchedFiles: recipe.touchedFiles,
        contributingSlices: recipe.contributingSlices,
        rationale: recipe.rationale,
        language: recipe.language,
        rev: recipe.rev,
        parentRecipeId: recipe.parentRecipeId,
        sourceJobId: recipe.sourceJobId,
        userEdited: recipe.userEdited,
        lastEditedBy: recipe.lastEditedBy,
        error: recipe.error,
        createdAt: recipe.createdAt.toISOString(),
        updatedAt: recipe.updatedAt.toISOString(),
        resolvedAt: recipe.resolvedAt !== null ? recipe.resolvedAt.toISOString() : null,
    };
}

/** jsonb로 저장돼 형태를 신뢰할 수 없는 슬라이스에서 인용된 태스크 ID만 중복 없이 모은다. */
export function citedTaskIds(recipes: readonly RecipeEntity[]): readonly string[] {
    const ids = new Set<string>();
    for (const recipe of recipes) {
        for (const slice of recipe.contributingSlices) {
            const taskId = (slice as { readonly taskId?: unknown }).taskId;
            if (typeof taskId === "string" && taskId.length > 0) ids.add(taskId);
        }
    }
    return [...ids];
}

export function mapRecipeApplication(application: RecipeApplicationEntity): RecipeApplicationDto {
    return {
        id: application.id,
        userId: application.userId,
        recipeId: application.recipeId,
        taskId: application.taskId,
        injectedVia: application.injectedVia,
        outcome: application.outcome,
        note: application.note,
        createdAt: application.createdAt.toISOString(),
        resolvedAt: application.resolvedAt !== null ? application.resolvedAt.toISOString() : null,
    };
}
