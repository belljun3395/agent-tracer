import {describe, expect, it} from "vitest";
import {RefreshRecipeCacheUsecase} from "~runtime/domain/recipe/application/refresh.recipe.cache.usecase.js";
import {InMemoryRecipeCache} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.cache.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

describe("RefreshRecipeCacheUsecase", () => {
    it("서버에서 활성 레시피를 받아 캐시를 갱신한다", async () => {
        const cache = new InMemoryRecipeCache();

        expect(await new RefreshRecipeCacheUsecase(cache).execute()).toBe(true);
        expect(cache.refreshCount).toBe(1);
    });

    it("서버 조회가 실패해도 옛 캐시를 남기고 실패만 알린다", async () => {
        const failing: RecipeCachePort = {
            load: () => [],
            refresh: () => Promise.reject(new Error("unreachable")),
        };

        expect(await new RefreshRecipeCacheUsecase(failing).execute()).toBe(false);
    });
});
