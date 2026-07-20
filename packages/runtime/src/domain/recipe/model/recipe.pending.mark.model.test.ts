import {describe, expect, it} from "vitest";
import {
    clearRecipeMark,
    markRecipeOpened,
    pendingRecipeMarkFor,
} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";

describe("markRecipeOpened", () => {
    it("태스크에 마크를 남긴다", () => {
        const store = markRecipeOpened({}, "task-1", "recipe-1", "2026-07-14T00:00:00.000Z");

        expect(pendingRecipeMarkFor(store, "task-1")).toEqual({
            taskId: "task-1",
            recipeId: "recipe-1",
            openedAt: "2026-07-14T00:00:00.000Z",
        });
    });

    it("같은 태스크에 이미 마크가 있으면 최신 호출로 덮어쓴다", () => {
        const first = markRecipeOpened({}, "task-1", "recipe-1", "2026-07-14T00:00:00.000Z");
        const second = markRecipeOpened(first, "task-1", "recipe-2", "2026-07-14T01:00:00.000Z");

        expect(pendingRecipeMarkFor(second, "task-1")?.recipeId).toBe("recipe-2");
    });
});

describe("pendingRecipeMarkFor", () => {
    it("마크가 없는 태스크는 undefined를 낸다", () => {
        expect(pendingRecipeMarkFor({}, "task-1")).toBeUndefined();
    });
});

describe("clearRecipeMark", () => {
    it("recipeId가 일치하면 마크를 지운다", () => {
        const store = markRecipeOpened({}, "task-1", "recipe-1", "2026-07-14T00:00:00.000Z");

        const cleared = clearRecipeMark(store, "task-1", "recipe-1");

        expect(pendingRecipeMarkFor(cleared, "task-1")).toBeUndefined();
    });

    it("recipeId가 다르면 더 최신 마크를 건드리지 않는다", () => {
        const store = markRecipeOpened({}, "task-1", "recipe-2", "2026-07-14T01:00:00.000Z");

        const result = clearRecipeMark(store, "task-1", "recipe-1");

        expect(pendingRecipeMarkFor(result, "task-1")?.recipeId).toBe("recipe-2");
    });

    it("마크가 없는 태스크는 그대로 둔다", () => {
        expect(clearRecipeMark({}, "task-1", "recipe-1")).toEqual({});
    });
});
