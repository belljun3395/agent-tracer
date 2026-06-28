import type { RecipeCandidateStatus } from "@monitor/insight-api/recipe/domain/const/recipe.const.js";
import type { RecipeStatus } from "@monitor/insight-api/recipe/domain/const/recipe.const.js";

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
