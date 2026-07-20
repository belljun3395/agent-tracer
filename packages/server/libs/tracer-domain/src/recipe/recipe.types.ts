export interface RecipeStats {
    readonly applied: number;
    readonly success: number;
    readonly successRate: number;
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
