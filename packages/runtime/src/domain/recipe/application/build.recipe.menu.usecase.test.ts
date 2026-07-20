import {describe, expect, it} from "vitest";
import {BuildRecipeMenuUsecase} from "~runtime/domain/recipe/application/build.recipe.menu.usecase.js";
import {InMemoryRecipeCache} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.cache.js";
import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

const RECIPE: CachedRecipe = {
    id: "recipe-1",
    title: "lint pipeline",
    intent: "lint pipeline before commit",
    description: "run lint",
    summaryMd: "",
    steps: [],
    pitfalls: [],
    corrections: [],
    touchedFiles: [],
    governingRules: [],
};

describe("BuildRecipeMenuUsecase", () => {
    it("캐시의 활성 레시피 전부로 메뉴를 만든다", () => {
        const usecase = new BuildRecipeMenuUsecase(new InMemoryRecipeCache([RECIPE]));

        const menu = usecase.execute();

        expect(menu).toContain("<agent-tracer-recipes>");
        expect(menu).toContain("recipe-1");
    });

    it("캐시가 비어 있으면 빈 문자열을 낸다", () => {
        const usecase = new BuildRecipeMenuUsecase(new InMemoryRecipeCache());

        expect(usecase.execute()).toBe("");
    });
});
