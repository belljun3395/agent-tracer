import type { RecipeWithStatsDto } from "@monitor/kernel";
import type {
  Recipe,
  RecipeSlice,
  RecipeStep,
  RecipeTouchedFile,
} from "~web/entities/recipe/model/recipe.js";

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
    steps: item.steps as readonly RecipeStep[],
    touchedFiles: item.touchedFiles.map((path): RecipeTouchedFile => ({ path, role: "both" })),
    contributingSlices: item.contributingSlices as readonly RecipeSlice[],
    rev: item.rev,
    parentRecipeId: item.parentRecipeId,
    status: item.status,
    userEdited: item.userEdited,
    lastEditedBy: item.lastEditedBy,
    appliedCount: item.stats.applied,
    successCount: item.stats.success,
    language: item.language,
    ...(item.rationale !== null ? { rationale: item.rationale } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
