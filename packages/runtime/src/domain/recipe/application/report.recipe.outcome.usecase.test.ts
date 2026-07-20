import {describe, expect, it} from "vitest";
import {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import {InMemoryRecipeOutcomeReport} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.outcome.report.js";

describe("ReportRecipeOutcomeUsecase", () => {
    it("recipeId와 taskId가 있으면 그대로 보고하고 accepted를 낸다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        const result = await usecase.execute({recipeId: "r1", taskId: "t1", outcome: "completed", note: "잘 됐다"});

        expect(result).toBe("accepted");
        expect(reports.reported).toEqual([{recipeId: "r1", taskId: "t1", outcome: "completed", note: "잘 됐다"}]);
    });

    it("recipeId나 taskId가 비어 있으면 보고하지 않고 rejected를 낸다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        expect(await usecase.execute({recipeId: "", taskId: "t1", outcome: "completed"})).toBe("rejected");
        expect(await usecase.execute({recipeId: "r1", taskId: "", outcome: "completed"})).toBe("rejected");
        expect(reports.reported).toEqual([]);
    });

    it("서버가 레시피가 없다고 확답하면 rejected를 그대로 낸다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        reports.respondNext("rejected");
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        expect(await usecase.execute({recipeId: "r1", taskId: "t1", outcome: "abandoned"})).toBe("rejected");
    });

    it("서버 보고가 예외로 튀어도 삼키고 unavailable을 낸다", async () => {
        const reports = new InMemoryRecipeOutcomeReport();
        reports.failNext();
        const usecase = new ReportRecipeOutcomeUsecase(reports);

        expect(await usecase.execute({recipeId: "r1", taskId: "t1", outcome: "abandoned"})).toBe("unavailable");
    });
});
