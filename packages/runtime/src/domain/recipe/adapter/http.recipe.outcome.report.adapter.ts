import {postJson} from "~runtime/config/http.js";
import type {
    RecipeOutcomeReportInput,
    RecipeOutcomeReportPort,
    RecipeOutcomeReportResult,
} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

/** 레시피 성과 보고를 서버의 적용 이력 커맨드 API로 보낸다. */
export class HttpRecipeOutcomeReportAdapter implements RecipeOutcomeReportPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async report(input: RecipeOutcomeReportInput): Promise<RecipeOutcomeReportResult> {
        const url = `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(input.recipeId)}/outcome`;
        let response: Response;
        try {
            response = await postJson(url, this.headers, {
                taskId: input.taskId,
                outcome: input.outcome,
                ...(input.note !== undefined ? {note: input.note} : {}),
            });
        } catch {
            return "unavailable";
        }
        if (response.ok) return "accepted";
        return response.status === 404 ? "rejected" : "unavailable";
    }
}
