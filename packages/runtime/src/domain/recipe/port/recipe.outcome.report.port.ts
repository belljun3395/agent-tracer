import type {RecipeOutcome} from "@monitor/kernel/recipe/recipe.const.js";

/** 에이전트가 스스로 판단한 레시피 성과를 서버 적용 이력에 보고한다. */
export interface RecipeOutcomeReportInput {
    readonly recipeId: string;
    readonly taskId: string;
    readonly outcome: RecipeOutcome;
    readonly note?: string;
}

export interface RecipeOutcomeReportPort {
    report(input: RecipeOutcomeReportInput): Promise<boolean>;
}
