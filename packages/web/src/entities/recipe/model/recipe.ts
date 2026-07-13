import type { TaskId } from "~web/shared/identity.js";

export type RecipeFileRole = "read" | "write" | "both";

export interface RecipeStep {
  readonly order: number;
  readonly action: string;
  readonly rationale?: string;
}

export interface RecipeTouchedFile {
  readonly path: string;
  readonly role: RecipeFileRole;
}

export interface RecipeSlice {
  readonly taskId: TaskId;
  readonly eventIds: readonly string[];
}

export interface RecipeCorrection {
  readonly whatAgentDid: string;
  readonly howCorrected: string;
  readonly evidence: readonly string[];
}

export interface RecipePitfall {
  readonly pitfall: string;
  readonly whyNonObvious: string;
  readonly evidence: readonly string[];
}

export type RecipeStatus = "candidate" | "active" | "superseded" | "retired" | "dismissed";
export type RecipeStatusFilter = RecipeStatus | "all";

export interface Recipe {
  readonly id: string;
  readonly sourceCandidateId: string | null;
  readonly sourceJobId: string | null;
  readonly title: string;
  readonly intent: string;
  readonly description: string;
  readonly summaryMd: string;
  readonly request: string;
  readonly corrections: readonly RecipeCorrection[];
  readonly pitfalls: readonly RecipePitfall[];
  readonly governingRules: readonly string[];
  readonly steps: readonly RecipeStep[];
  readonly touchedFiles: readonly RecipeTouchedFile[];
  readonly contributingSlices: readonly RecipeSlice[];
  readonly rev: number;
  readonly parentRecipeId: string | null;
  readonly status: RecipeStatus;
  readonly userEdited: boolean;
  readonly lastEditedBy: string;
  readonly appliedCount: number;
  readonly successCount: number;
  readonly language: string | null;
  readonly rationale?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecipesResponse {
  readonly recipes: readonly Recipe[];
  readonly taskTitleById: ReadonlyMap<string, string>;
}

export interface RecipeEditInput {
  readonly title?: string;
  readonly intent?: string;
  readonly description?: string;
  readonly summaryMd?: string;
}
