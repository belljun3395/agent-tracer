export interface CachedRecipeStep {
    readonly order: number;
    readonly action: string;
    readonly rationale?: string;
}

export interface CachedRecipeCorrection {
    readonly whatAgentDid: string;
    readonly howCorrected: string;
}

export interface CachedRecipePitfall {
    readonly pitfall: string;
    readonly whyNonObvious: string;
}

export interface CachedRecipeTouchedFile {
    readonly path: string;
    readonly role: "read" | "write" | "both";
}

/** 캐시가 담는 레시피는 본문 전체이며 활성화 판단은 에이전트가 get_recipe로 직접 열어본 뒤 내린다. */
export interface CachedRecipe {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly steps: readonly CachedRecipeStep[];
    readonly pitfalls: readonly CachedRecipePitfall[];
    readonly corrections: readonly CachedRecipeCorrection[];
    readonly touchedFiles: readonly CachedRecipeTouchedFile[];
    readonly governingRules: readonly string[];
}
