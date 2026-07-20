import type {
    RecipeOutcomeReportInput,
    RecipeOutcomeReportPort,
    RecipeOutcomeReportResult,
} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

/** 서버가 잠깐 죽어도 도구 호출이 예외로 튀지 않도록 보고를 감싸고, 없는 레시피와 접속 실패를 구분해 낸다. */
export class ReportRecipeOutcomeUsecase {
    constructor(private readonly reports: RecipeOutcomeReportPort) {}

    async execute(input: RecipeOutcomeReportInput): Promise<RecipeOutcomeReportResult> {
        if (input.recipeId === "" || input.taskId === "") return "rejected";
        try {
            return await this.reports.report(input);
        } catch {
            return "unavailable";
        }
    }
}
