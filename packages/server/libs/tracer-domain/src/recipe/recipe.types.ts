export interface RecipeVerdictBreakdown {
    readonly followedAndHelped: number;
    readonly followedNotHelped: number;
    readonly abandoned: number;
    readonly unknown: number;
}

/** applicationCount는 판정과 무관한 적용 행 총 수이고, decidedCount는 그중 unknown을 뺀 종결 판정 수다. */
export interface RecipeStats {
    readonly applicationCount: number;
    readonly decidedCount: number;
    readonly successRate: number;
    readonly verdicts: RecipeVerdictBreakdown;
}

export const EMPTY_RECIPE_STATS: RecipeStats = {
    applicationCount: 0,
    decidedCount: 0,
    successRate: 0,
    verdicts: { followedAndHelped: 0, followedNotHelped: 0, abandoned: 0, unknown: 0 },
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

/** 레시피 적용 판정의 근거이며, 관측이 아니라 자기보고로 대체됐는지를 source가 말한다. */
export interface RecipeVerdictEvidence {
    readonly verifiableStepCount: number;
    readonly followedStepOrders: readonly number[];
    readonly unclassifiedEventCount: number;
    readonly windowComplete: boolean;
    readonly source: "observed" | "self-report";
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
