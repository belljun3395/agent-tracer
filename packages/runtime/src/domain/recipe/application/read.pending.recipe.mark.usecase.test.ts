import {describe, expect, it} from "vitest";
import {PENDING_MARK_TTL_MS} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import {FixedClock} from "~runtime/domain/recipe/port/__fakes__/fixed.clock.js";
import {InMemoryRecipePendingMarkStore} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.pending.mark.js";
import {ReadPendingRecipeMarkUsecase} from "~runtime/domain/recipe/application/read.pending.recipe.mark.usecase.js";

const NOW = Date.parse("2026-07-20T00:00:00.000Z");

describe("ReadPendingRecipeMarkUsecase", () => {
    it("마크가 있는 태스크는 가장 오래된 마크를 낸다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        marks.write("task-1", [
            {recipeId: "recipe-1", openedAt: "2026-07-19T23:00:00.000Z"},
            {recipeId: "recipe-2", openedAt: "2026-07-19T23:30:00.000Z"},
        ]);
        const usecase = new ReadPendingRecipeMarkUsecase(marks, new FixedClock(NOW));

        expect(usecase.execute("task-1")?.recipeId).toBe("recipe-1");
    });

    it("마크가 없는 태스크는 undefined를 낸다", () => {
        const usecase = new ReadPendingRecipeMarkUsecase(new InMemoryRecipePendingMarkStore(), new FixedClock(NOW));

        expect(usecase.execute("task-2")).toBeUndefined();
    });

    it("태스크 id가 비어 있으면 undefined를 낸다", () => {
        const usecase = new ReadPendingRecipeMarkUsecase(new InMemoryRecipePendingMarkStore(), new FixedClock(NOW));

        expect(usecase.execute("")).toBeUndefined();
    });

    it("ttl을 넘긴 마크는 지우고 남은 것만 낸다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        const expiredAt = new Date(NOW - PENDING_MARK_TTL_MS - 1).toISOString();
        const aliveAt = new Date(NOW - 1000).toISOString();
        marks.write("task-1", [
            {recipeId: "recipe-old", openedAt: expiredAt},
            {recipeId: "recipe-new", openedAt: aliveAt},
        ]);
        const usecase = new ReadPendingRecipeMarkUsecase(marks, new FixedClock(NOW));

        const mark = usecase.execute("task-1");

        expect(mark?.recipeId).toBe("recipe-new");
        expect(marks.read("task-1")).toEqual([{recipeId: "recipe-new", openedAt: aliveAt}]);
    });

    it("만료된 마크가 없으면 다시 쓰지 않는다", () => {
        const marks = new InMemoryRecipePendingMarkStore();
        marks.write("task-1", [{recipeId: "recipe-1", openedAt: new Date(NOW - 1000).toISOString()}]);
        marks.writeCalls = [];
        const usecase = new ReadPendingRecipeMarkUsecase(marks, new FixedClock(NOW));

        usecase.execute("task-1");

        expect(marks.writeCalls).toEqual([]);
    });
});
