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

        const fetched = await usecase.execute("recipe-1");

        expect(fetched.kind).toBe("found");
        expect(fetched.kind === "found" && fetched.value).toContain("# lint pipeline");
        expect(fetched.kind === "found" && fetched.value).toContain("1. run lint");
    });

    it("recipeId가 서버에 없으면 absent를 낸다", async () => {
        const usecase = new GetRecipeUsecase(new InMemoryRecipeFetch());

        expect(await usecase.execute("missing")).toEqual({kind: "absent"});
    });

    it("서버가 확답을 못 하면 unavailable을 낸다", async () => {
        const fetcher = new InMemoryRecipeFetch();
        fetcher.respondUnavailableNext();
        const usecase = new GetRecipeUsecase(fetcher);

        expect(await usecase.execute("recipe-1")).toEqual({kind: "unavailable"});
    });

    it("서버 조회가 예외로 튀어도 삼키고 unavailable을 낸다", async () => {
        const fetcher = new InMemoryRecipeFetch();
        fetcher.failNext();
        const usecase = new GetRecipeUsecase(fetcher);

        expect(await usecase.execute("recipe-1")).toEqual({kind: "unavailable"});
    });
});
