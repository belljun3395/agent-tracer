import {describe, expect, it} from "vitest";
import {SearchRecipesUsecase} from "~runtime/domain/recipe/application/search.recipes.usecase.js";
import {InMemoryRecipeSearch} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.search.js";
import type {RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";

function item(id: string): RecipeSearchResultItem {
    return {recipeId: id, title: `title-${id}`, intent: `intent-${id}`, description: `description-${id}`, score: 1};
}

describe("SearchRecipesUsecase", () => {
    it("질의어를 다듬어 포트에 넘기고 기본 limit 3을 쓴다", async () => {
        const search = new InMemoryRecipeSearch();
        const usecase = new SearchRecipesUsecase(search);

        await usecase.execute({query: "  린트  "});

        expect(search.calls).toEqual([{query: "린트", limit: 3}]);
    });

    it("limit을 넘기면 그대로 전달한다", async () => {
        const search = new InMemoryRecipeSearch();
        const usecase = new SearchRecipesUsecase(search);

        await usecase.execute({query: "린트", limit: 5});

        expect(search.calls).toEqual([{query: "린트", limit: 5}]);
    });

    it("질의어가 공백뿐이면 포트를 부르지 않고 빈 목록을 낸다", async () => {
        const search = new InMemoryRecipeSearch();
        const usecase = new SearchRecipesUsecase(search);

        const items = await usecase.execute({query: "   "});

        expect(items).toEqual([]);
        expect(search.calls).toEqual([]);
    });

    it("포트가 낸 결과를 그대로 낸다", async () => {
        const search = new InMemoryRecipeSearch();
        search.seed([item("r1"), item("r2")]);
        const usecase = new SearchRecipesUsecase(search);

        const items = await usecase.execute({query: "린트"});

        expect(items.map((i) => i.recipeId)).toEqual(["r1", "r2"]);
    });

    it("서버 조회가 실패해도 예외를 삼키고 빈 목록을 낸다", async () => {
        const search = new InMemoryRecipeSearch();
        search.failNext();
        const usecase = new SearchRecipesUsecase(search);

        expect(await usecase.execute({query: "린트"})).toEqual([]);
    });
});
