import {describe, expect, it} from "vitest";
import {InMemoryRecipePendingMarkStore} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.pending.mark.js";
import {ClearRecipeMarkUsecase} from "~runtime/domain/recipe/application/clear.recipe.mark.usecase.js";

describe("ClearRecipeMarkUsecase", () => {
    it("보고된 recipeId가 마크와 일치하면 지운다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        marks.write({"task-1": {taskId: "task-1", recipeId: "recipe-1", openedAt: "2026-07-20T00:00:00.000Z"}});
        const usecase = new ClearRecipeMarkUsecase(marks);

        usecase.execute("task-1", "recipe-1");

        expect(marks.read()["task-1"]).toBeUndefined();
    });

    it("태스크나 레시피가 비어 있으면 지우지 않는다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        marks.write({"task-1": {taskId: "task-1", recipeId: "recipe-1", openedAt: "2026-07-20T00:00:00.000Z"}});
        const usecase = new ClearRecipeMarkUsecase(marks);

        usecase.execute("", "recipe-1");
        usecase.execute("task-1", "");

        expect(marks.read()["task-1"]).toBeDefined();
    });
});
