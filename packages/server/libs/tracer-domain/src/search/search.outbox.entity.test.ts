import { describe, expect, it } from "vitest";
import { SEARCH_OUTBOX_TARGET } from "./search.outbox.const.js";
import { SearchOutboxEntity } from "./search.outbox.entity.js";

const NOW = new Date("2026-07-16T00:00:00.000Z");

describe("SearchOutboxEntity", () => {
    it("target으로 배출기가 분기할 대상을 판정한다", () => {
        const recipeRow = SearchOutboxEntity.enqueue({ id: "1", userId: "u1", target: SEARCH_OUTBOX_TARGET.recipe, targetId: "r1", now: NOW });
        const memoRow = SearchOutboxEntity.enqueue({ id: "2", userId: "u1", target: SEARCH_OUTBOX_TARGET.memo, targetId: "m1", now: NOW });

        expect(recipeRow.isRecipe()).toBe(true);
        expect(recipeRow.isMemo()).toBe(false);
        expect(memoRow.isMemo()).toBe(true);
        expect(memoRow.isRecipe()).toBe(false);
    });
});
