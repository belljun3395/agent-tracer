import type {
    RecipeOutcomeReportInput,
    RecipeOutcomeReportPort,
    RecipeOutcomeReportResult,
} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

export class InMemoryRecipeOutcomeReport implements RecipeOutcomeReportPort {
    readonly reported: RecipeOutcomeReportInput[] = [];
    private nextThrows = false;
    private nextResult: RecipeOutcomeReportResult | undefined;

    /** 서버 보고가 예외로 튀는 상황을 재현한다. */
    failNext(): void {
        this.nextThrows = true;
    }

    /** 다음 보고가 낼 결과를 강제한다(수락 대신 거부 또는 접속 실패). */
    respondNext(result: RecipeOutcomeReportResult): void {
        this.nextResult = result;
    }

    async report(input: RecipeOutcomeReportInput): Promise<RecipeOutcomeReportResult> {
        if (this.nextThrows) throw new Error("report failed");
        if (this.nextResult !== undefined) return this.nextResult;
        this.reported.push(input);
        return "accepted";
    }
}
