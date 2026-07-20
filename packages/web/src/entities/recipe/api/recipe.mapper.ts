import type { RecipeWithStatsDto } from "@monitor/kernel";
import type { Recipe, RecipeSlice } from "~web/entities/recipe/model/recipe.js";

export function toRecipe(item: RecipeWithStatsDto): Recipe {
  return {
    id: item.id,
    sourceCandidateId: null,
    sourceJobId: item.sourceJobId,
    title: item.title,
    intent: item.intent,
    description: item.description,
    summaryMd: item.summaryMd,
    request: item.request,
    corrections: item.corrections,
    pitfalls: item.pitfalls,
    governingRules: item.governingRules,
    steps: item.steps,
    touchedFiles: item.touchedFiles,
    contributingSlices: item.contributingSlices as readonly RecipeSlice[],
    rev: item.rev,
    parentRecipeId: item.parentRecipeId,
    status: item.status,
    userEdited: item.userEdited,
    lastEditedBy: item.lastEditedBy,
    applicationCount: item.stats.applicationCount,
    verdicts: item.stats.verdicts,
    language: item.language,
    ...(item.rationale !== null ? { rationale: item.rationale } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
