import type {RecipeOutcomeReportInput, RecipeOutcomeReportPort} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

export class InMemoryRecipeOutcomeReport implements RecipeOutcomeReportPort {
    readonly reported: RecipeOutcomeReportInput[] = [];
    private shouldFail = false;

    /** 서버 보고가 실패하는 상황을 재현한다. */
    failNext(): void {
        this.shouldFail = true;
    }

    async report(input: RecipeOutcomeReportInput): Promise<boolean> {
        if (this.shouldFail) throw new Error("report failed");
        this.reported.push(input);
        return true;
    }
}
