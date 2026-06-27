import type { RecipeCandidateStatus } from "@monitor/insight-api/recipe/domain/recipe.candidate.entity.js";
import type { RecipeStatus } from "@monitor/insight-api/recipe/domain/recipe.entity.js";

export type RecipeCandidateStatusFilter = "pending" | "all";

export interface RecipeStepDto {
    readonly order: number;
    readonly action: string;
    readonly rationale?: string;
}

export interface RecipeTouchedFileDto {
    readonly path: string;
    readonly role: "read" | "write" | "both";
}

export interface RecipeSliceDto {
    readonly taskId: string;
    readonly eventIds: readonly string[];
}

export interface RecipeCandidateDto {
    readonly id: string;
    readonly jobId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly steps: readonly RecipeStepDto[];
    readonly touchedFiles: readonly RecipeTouchedFileDto[];
    readonly contributingSlices: readonly RecipeSliceDto[];
    readonly rationale: string;
    readonly language: string | null;
    readonly parentRecipeId: string | null;
    readonly status: RecipeCandidateStatus;
    readonly error: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
}

export interface RecipeDto {
    readonly id: string;
    readonly sourceCandidateId: string | null;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly steps: readonly RecipeStepDto[];
    readonly touchedFiles: readonly RecipeTouchedFileDto[];
    readonly contributingSlices: readonly RecipeSliceDto[];
    readonly rev: number;
    readonly parentRecipeId: string | null;
    readonly status: RecipeStatus;
    readonly appliedCount: number;
    readonly successCount: number;
    readonly language: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface ListRecipeCandidatesUseCaseIn {
    readonly status?: RecipeCandidateStatusFilter;
}

export interface ListRecipeCandidatesUseCaseOut {
    readonly candidates: readonly RecipeCandidateDto[];
}

export interface AcceptRecipeCandidateUseCaseIn {
    readonly candidateId: string;
}

export interface AcceptRecipeCandidateUseCaseOut {
    readonly status: "accepted" | "not_found" | "not_pending";
    readonly recipeId?: string;
}

export interface DismissRecipeCandidateUseCaseIn {
    readonly candidateId: string;
}

export interface DismissRecipeCandidateUseCaseOut {
    readonly status: "dismissed" | "not_found" | "not_pending";
}

export interface ListRecipesUseCaseIn {
    readonly status?: RecipeStatus | "all";
}

export interface ListRecipesUseCaseOut {
    readonly recipes: readonly RecipeDto[];
}

export interface RetireRecipeUseCaseIn {
    readonly recipeId: string;
}

export interface RetireRecipeUseCaseOut {
    readonly status: "retired" | "not_found" | "already_retired";
}
