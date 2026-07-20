import {describe, expect, it} from "vitest";
import {InMemoryRecipePendingMarkStore} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.pending.mark.js";
import {ReadPendingRecipeMarkUsecase} from "~runtime/domain/recipe/application/read.pending.recipe.mark.usecase.js";

describe("ReadPendingRecipeMarkUsecase", () => {
    it("마크가 있는 태스크는 그 마크를 낸다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        marks.write({"task-1": {taskId: "task-1", recipeId: "recipe-1", openedAt: "2026-07-20T00:00:00.000Z"}});
        const usecase = new ReadPendingRecipeMarkUsecase(marks);

        expect(usecase.execute("task-1")?.recipeId).toBe("recipe-1");
    });

    it("마크가 없는 태스크는 undefined를 낸다", () => {
        const usecase = new ReadPendingRecipeMarkUsecase(new InMemoryRecipePendingMarkStore());

        expect(usecase.execute("task-2")).toBeUndefined();
    });

    it("태스크 id가 비어 있으면 undefined를 낸다", () => {
        const usecase = new ReadPendingRecipeMarkUsecase(new InMemoryRecipePendingMarkStore());

        expect(usecase.execute("")).toBeUndefined();
    });
});
