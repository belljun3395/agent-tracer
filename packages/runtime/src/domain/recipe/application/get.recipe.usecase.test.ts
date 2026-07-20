import {describe, expect, it} from "vitest";
import {GetRecipeUsecase} from "~runtime/domain/recipe/application/get.recipe.usecase.js";
import {InMemoryRecipeFetch} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.fetch.js";
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
    it("recipeId가 서버에 있으면 본문 전문을 낸다", async () => {
        const fetcher = new InMemoryRecipeFetch();
        fetcher.seed(RECIPE);
        const usecase = new GetRecipeUsecase(fetcher);

        const body = await usecase.execute("recipe-1");

        expect(body).toContain("# lint pipeline");
        expect(body).toContain("1. run lint");
    });

    it("recipeId가 서버에 없으면 null을 낸다", async () => {
        const usecase = new GetRecipeUsecase(new InMemoryRecipeFetch());

        expect(await usecase.execute("missing")).toBeNull();
    });

    it("서버 조회가 실패해도 예외를 삼키고 null을 낸다", async () => {
        const fetcher = new InMemoryRecipeFetch();
        fetcher.failNext();
        const usecase = new GetRecipeUsecase(fetcher);

        expect(await usecase.execute("recipe-1")).toBeNull();
    });
});
