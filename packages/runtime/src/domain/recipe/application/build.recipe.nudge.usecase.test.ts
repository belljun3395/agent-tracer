import {describe, expect, it} from "vitest";
import {BuildRecipeNudgeUsecase} from "~runtime/domain/recipe/application/build.recipe.nudge.usecase.js";
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

describe("BuildRecipeNudgeUsecase", () => {
    it("캐시된 레시피 개수로 넛지를 만든다", () => {
        const usecase = new BuildRecipeNudgeUsecase(new InMemoryRecipeCache([RECIPE]));

        const nudge = usecase.execute();

        expect(nudge).toContain("<agent-tracer-recipes>");
        expect(nudge).toContain("1 saved recipe —");
    });

    it("캐시가 비어 있으면 빈 문자열을 낸다", () => {
        const usecase = new BuildRecipeNudgeUsecase(new InMemoryRecipeCache());

        expect(usecase.execute()).toBe("");
    });
});
