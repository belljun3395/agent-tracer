import {describe, expect, it} from "vitest";
import {FixedClock} from "~runtime/domain/recipe/port/__fakes__/fixed.clock.js";
import {InMemoryRecipePendingMarkStore} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.pending.mark.js";
import {MarkRecipeOpenedUsecase} from "~runtime/domain/recipe/application/mark.recipe.opened.usecase.js";

const NOW = Date.parse("2026-07-20T00:00:00.000Z");

describe("MarkRecipeOpenedUsecase", () => {
    it("태스크와 레시피가 있으면 마크를 남긴다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        const usecase = new MarkRecipeOpenedUsecase(marks, new FixedClock(NOW));

        usecase.execute("task-1", "recipe-1");

        expect(marks.read()["task-1"]).toEqual({
            taskId: "task-1",
            recipeId: "recipe-1",
            openedAt: new Date(NOW).toISOString(),
        });
    });

    it("태스크나 레시피가 비어 있으면 아무것도 남기지 않는다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        const usecase = new MarkRecipeOpenedUsecase(marks, new FixedClock(NOW));

        usecase.execute("", "recipe-1");
        usecase.execute("task-1", "");

        expect(marks.read()).toEqual({});
    });
});
