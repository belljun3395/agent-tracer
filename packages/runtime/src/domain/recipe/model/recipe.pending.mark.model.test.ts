import {describe, expect, it} from "vitest";
import {
    MAX_PENDING_MARKS_PER_TASK,
    clearRecipeMark,
    dropExpiredMarks,
    markRecipeOpened,
} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";

describe("markRecipeOpened", () => {
    it("마크를 목록에 더한다", () => {
        const marks = markRecipeOpened([], "recipe-1", "2026-07-14T00:00:00.000Z");

        expect(marks).toEqual([{recipeId: "recipe-1", openedAt: "2026-07-14T00:00:00.000Z"}]);
    });

    it("같은 recipeId가 이미 있으면 최신 시각으로 갱신하고 자리를 맨 끝으로 옮긴다", () => {
        const first = markRecipeOpened([], "recipe-1", "2026-07-14T00:00:00.000Z");
        const withSecond = markRecipeOpened(first, "recipe-2", "2026-07-14T00:01:00.000Z");
        const reopened = markRecipeOpened(withSecond, "recipe-1", "2026-07-14T00:02:00.000Z");

        expect(reopened).toEqual([
            {recipeId: "recipe-2", openedAt: "2026-07-14T00:01:00.000Z"},
            {recipeId: "recipe-1", openedAt: "2026-07-14T00:02:00.000Z"},
        ]);
    });

    it(`상한 ${MAX_PENDING_MARKS_PER_TASK}개를 넘기면 가장 오래된 마크부터 밀어낸다`, () => {
        const marks = ["recipe-1", "recipe-2", "recipe-3", "recipe-4"].reduce(
            (acc, recipeId, index) => markRecipeOpened(acc, recipeId, `2026-07-14T00:0${index}:00.000Z`),
            [] as ReturnType<typeof markRecipeOpened>,
        );

        expect(marks.map((mark) => mark.recipeId)).toEqual(["recipe-2", "recipe-3", "recipe-4"]);
    });
});

describe("clearRecipeMark", () => {
    it("recipeId가 일치하는 마크만 지운다", () => {
        const marks = markRecipeOpened(
            markRecipeOpened([], "recipe-1", "2026-07-14T00:00:00.000Z"),
            "recipe-2",
            "2026-07-14T00:01:00.000Z",
        );

        const cleared = clearRecipeMark(marks, "recipe-1");

        expect(cleared).toEqual([{recipeId: "recipe-2", openedAt: "2026-07-14T00:01:00.000Z"}]);
    });

    it("일치하는 마크가 없으면 그대로 둔다", () => {
        expect(clearRecipeMark([], "recipe-1")).toEqual([]);
    });
});

describe("dropExpiredMarks", () => {
    const TTL_MS = 1000;

    it("ttl을 넘긴 마크를 지운다", () => {
        const marks = [{recipeId: "recipe-1", openedAt: new Date(0).toISOString()}];

        expect(dropExpiredMarks(marks, TTL_MS + 1, TTL_MS)).toEqual([]);
    });

    it("ttl 안의 마크는 그대로 둔다", () => {
        const marks = [{recipeId: "recipe-1", openedAt: new Date(0).toISOString()}];

        expect(dropExpiredMarks(marks, TTL_MS - 1, TTL_MS)).toEqual(marks);
    });
});
