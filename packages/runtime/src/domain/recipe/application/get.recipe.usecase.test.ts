import {describe, expect, it} from "vitest";
import {GetRecipeUsecase} from "~runtime/domain/recipe/application/get.recipe.usecase.js";
import {InMemoryRecipeCache} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.cache.js";
import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

const RECIPE: CachedRecipe = {
    id: "recipe-1",
    title: "lint pipeline",
    intent: "lint pipeline before commit",
    description: "run lint",
    summaryMd: "",
    steps: [{order: 1, action: "run lint"}],
    pitfalls: [],
    corrections: [],
    touchedFiles: [],
    governingRules: [],
};

describe("GetRecipeUsecase", () => {
    it("recipeId가 캐시에 있으면 본문 전문을 낸다", () => {
        const usecase = new GetRecipeUsecase(new InMemoryRecipeCache([RECIPE]));

        const body = usecase.execute("recipe-1");

        expect(body).toContain("# lint pipeline");
        expect(body).toContain("1. run lint");
    });

    it("recipeId가 캐시에 없으면 null을 낸다", () => {
        const usecase = new GetRecipeUsecase(new InMemoryRecipeCache([RECIPE]));

        expect(usecase.execute("missing")).toBeNull();
    });
});
