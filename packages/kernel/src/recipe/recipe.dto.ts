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

export type RecipeFileRole = "read" | "write" | "both";

export interface RecipeTouchedFileDto {
    readonly path: string;
    readonly role: RecipeFileRole;
}

export type RecipeVerifyTool = "command" | "file-read" | "file-write" | "web";

export interface RecipeVerifyCommandDto {
    readonly kind: "command";
    readonly commandMatches: readonly string[];
}

export interface RecipeVerifyPatternDto {
    readonly kind: "pattern";
    readonly pattern: string;
}

export interface RecipeVerifyActionDto {
    readonly kind: "action";
    readonly tool: RecipeVerifyTool;
}

export type RecipeVerifyDto = RecipeVerifyCommandDto | RecipeVerifyPatternDto | RecipeVerifyActionDto;

export interface RecipeStepDto {
    readonly order: number;
    readonly action: string;
    readonly rationale?: string;
    readonly verify?: RecipeVerifyDto;
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
    readonly steps: readonly RecipeStepDto[];
    readonly touchedFiles: readonly RecipeTouchedFileDto[];
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
    readonly outcome: RecipeOutcome | null;
    readonly note: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
}
