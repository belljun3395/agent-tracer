import type { RecipeInjectedVia } from "../ingest/event.kind.const.js";
import type { RecipeEditor, RecipeOutcome, RecipeStatus } from "./recipe.const.js";

export interface RecipeStatsDto {
    readonly applied: number;
    readonly success: number;
    readonly successRate: number;
}

export interface RecipeCorrectionDto {
    readonly whatAgentDid: string;
    readonly howCorrected: string;
    readonly evidence: readonly string[];
}

export interface RecipePitfallDto {
    readonly pitfall: string;
    readonly whyNonObvious: string;
    readonly evidence: readonly string[];
}

export interface RecipeDto {
    readonly id: string;
    readonly userId: string;
    readonly status: RecipeStatus;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly request: string;
    readonly corrections: readonly RecipeCorrectionDto[];
    readonly pitfalls: readonly RecipePitfallDto[];
    readonly governingRules: readonly string[];
    readonly steps: readonly unknown[];
    readonly touchedFiles: readonly string[];
    readonly contributingSlices: readonly unknown[];
    readonly rationale: string | null;
    readonly language: string | null;
    readonly rev: number;
    readonly parentRecipeId: string | null;
    readonly sourceJobId: string | null;
    readonly userEdited: boolean;
    readonly lastEditedBy: RecipeEditor;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly resolvedAt: string | null;
}

export interface RecipeWithStatsDto extends RecipeDto {
    readonly stats: RecipeStatsDto;
}

export interface RecipeApplicationDto {
    readonly id: string;
    readonly userId: string;
    readonly recipeId: string;
    readonly taskId: string;
    readonly injectedVia: RecipeInjectedVia;
    readonly score: number | null;
    readonly outcome: RecipeOutcome | null;
    readonly note: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
}
