/** applicationCount는 자기보고 여부와 무관한 적용 행 총 수이고, decidedCount는 그중 자기보고가 붙은 수다. */
export interface RecipeStats {
    readonly applicationCount: number;
    readonly decidedCount: number;
    readonly successRate: number;
}

export const EMPTY_RECIPE_STATS: RecipeStats = {
    applicationCount: 0,
    decidedCount: 0,
    successRate: 0,
};

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

export interface RecipeTouchedFile {
    readonly path: string;
    readonly role: "read" | "write" | "both";
}

export interface RecipeRevisionInput {
    readonly title?: string;
    readonly intent?: string;
    readonly description?: string;
    readonly summaryMd?: string;
    readonly request?: string;
    readonly corrections?: readonly RecipeCorrection[];
    readonly pitfalls?: readonly RecipePitfall[];
    readonly governingRules?: readonly string[];
    readonly steps?: readonly unknown[];
    readonly touchedFiles?: readonly RecipeTouchedFile[];
    readonly contributingSlices?: readonly unknown[];
    readonly rationale?: string | null;
    readonly language?: string | null;
    readonly sourceJobId?: string | null;
}

export interface RecipeCandidateInput {
    readonly id: string;
    readonly userId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly request: string;
    readonly corrections: readonly RecipeCorrection[];
    readonly pitfalls: readonly RecipePitfall[];
    readonly governingRules: readonly string[];
    readonly steps: readonly unknown[];
    readonly touchedFiles: readonly RecipeTouchedFile[];
    readonly contributingSlices: readonly unknown[];
    readonly rationale?: string;
    readonly language?: string;
    readonly parentRecipeId?: string;
    readonly sourceJobId?: string;
}
