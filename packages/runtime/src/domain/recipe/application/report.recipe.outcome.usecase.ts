import type {RecipeOutcomeReportInput, RecipeOutcomeReportPort} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

/** 서버가 잠깐 죽어도 도구 호출이 예외로 튀지 않도록 보고 실패를 흡수한다. */
export class ReportRecipeOutcomeUsecase {
    constructor(private readonly reports: RecipeOutcomeReportPort) {}

    async execute(input: RecipeOutcomeReportInput): Promise<boolean> {
        if (input.recipeId === "" || input.taskId === "") return false;
        try {
            return await this.reports.report(input);
        } catch {
            return false;
        }
    }
}
