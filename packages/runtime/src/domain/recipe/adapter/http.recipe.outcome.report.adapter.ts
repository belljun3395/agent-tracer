import {postJson} from "~runtime/config/http.js";
import type {RecipeOutcomeReportInput, RecipeOutcomeReportPort} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

/** 레시피 성과 보고를 서버의 적용 이력 커맨드 API로 보낸다. */
export class HttpRecipeOutcomeReportAdapter implements RecipeOutcomeReportPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async report(input: RecipeOutcomeReportInput): Promise<boolean> {
        const url = `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(input.recipeId)}/outcome`;
        const response = await postJson(url, this.headers, {
            taskId: input.taskId,
            outcome: input.outcome,
            ...(input.note !== undefined ? {note: input.note} : {}),
        });
        return response.ok;
    }
}
