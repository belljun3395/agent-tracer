import type {RecipeOutcome} from "@monitor/kernel/recipe/recipe.const.js";

/** 에이전트가 스스로 판단한 레시피 성과를 서버 적용 이력에 보고한다. */
export interface RecipeOutcomeReportInput {
    readonly recipeId: string;
    readonly taskId: string;
    readonly outcome: RecipeOutcome;
    readonly note?: string;
}

/** `accepted`는 서버가 받아들임, `rejected`는 그 레시피가 이미 없다는 확답(404), `unavailable`은 확답을 못 받음이다. */
export type RecipeOutcomeReportResult = "accepted" | "rejected" | "unavailable";

export interface RecipeOutcomeReportPort {
    report(input: RecipeOutcomeReportInput): Promise<RecipeOutcomeReportResult>;
}
