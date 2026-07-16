import {describe, expect, it} from "vitest";
import {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import {InMemoryRecipeOutcomeReport} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.outcome.report.js";

describe("ReportRecipeOutcomeUsecase", () => {
    it("recipeId와 taskId가 있으면 그대로 보고한다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        const ok = await usecase.execute({recipeId: "r1", taskId: "t1", outcome: "completed", note: "잘 됐다"});

        expect(ok).toBe(true);
        expect(reports.reported).toEqual([{recipeId: "r1", taskId: "t1", outcome: "completed", note: "잘 됐다"}]);
    });

    it("recipeId나 taskId가 비어 있으면 보고하지 않는다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        expect(await usecase.execute({recipeId: "", taskId: "t1", outcome: "completed"})).toBe(false);
        expect(await usecase.execute({recipeId: "r1", taskId: "", outcome: "completed"})).toBe(false);
        expect(reports.reported).toEqual([]);
    });

    it("서버 보고가 실패해도 예외를 삼키고 false를 낸다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        reports.failNext();
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        expect(await usecase.execute({recipeId: "r1", taskId: "t1", outcome: "abandoned"})).toBe(false);
    });
});
