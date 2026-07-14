import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RecipeEntity, type RecipeRepository } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/recipe/port/__fakes__/fixed.clock.js";
import type { RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { DeleteRecipeUseCase } from "./delete.recipe.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeRecipe(id: string, userId = "u1"): RecipeEntity {
    return RecipeEntity.candidate(
        {
            id,
            userId,
            title: "제목",
            intent: "intent",
            description: "설명",
            summaryMd: "요약",
            request: "요청",
            corrections: [],
            pitfalls: [],
            governingRules: [],
            steps: [],
            touchedFiles: [],
            contributingSlices: [],
        },
        NOW,
    );
}

function makeUseCase(args: { readonly recipes: readonly RecipeEntity[]; readonly removed?: string[] }) {
    const store = new Map(args.recipes.map((recipe) => [recipe.id, recipe]));
    const recipes = {
        findById: async (id: string) => {
            const found = store.get(id);
            return found !== undefined && !found.isDeleted() ? found : null;
        },
        upsert: async (recipe: RecipeEntity) => store.set(recipe.id, recipe),
    } as unknown as RecipeRepository;
    const search = {
        remove: async (id: string) => void args.removed?.push(id),
    } as unknown as RecipeSearchPort;
    return new DeleteRecipeUseCase(recipes, new FixedClock(new Date("2026-01-01T00:00:00.000Z")), search);
}

describe("DeleteRecipeUseCase", () => {
    it("기각된 레시피를 지우고 검색 색인에서도 제거한다", async () => {
        const recipe = makeRecipe("r1");
        recipe.dismiss(NOW);
        const removed: string[] = [];
        const usecase = makeUseCase({ recipes: [recipe], removed });

        const result = await usecase.execute("u1", "r1");

        expect(result).toEqual({ deleted: true, id: "r1" });
        expect(recipe.isDeleted()).toBe(true);
        expect(removed).toEqual(["r1"]);
    });

    it("폐기된 레시피도 지울 수 있다", async () => {
        const recipe = makeRecipe("r1");
        recipe.accept(NOW);
        recipe.retire(NOW);
        const usecase = makeUseCase({ recipes: [recipe] });

        await usecase.execute("u1", "r1");

        expect(recipe.isDeleted()).toBe(true);
    });

    it("대체된 레시피는 계보가 끊기므로 지우지 않는다", async () => {
        const recipe = makeRecipe("r1");
        recipe.supersede("r2", NOW);
        const usecase = makeUseCase({ recipes: [recipe] });

        await expect(usecase.execute("u1", "r1")).rejects.toThrow(/not-deletable/);
        expect(recipe.isDeleted()).toBe(false);
    });

    it("활성 레시피는 지우지 않는다", async () => {
        const recipe = makeRecipe("r1");
        recipe.accept(NOW);
        const usecase = makeUseCase({ recipes: [recipe] });

        await expect(usecase.execute("u1", "r1")).rejects.toThrow(/not-deletable/);
    });

    it("다른 사용자의 레시피는 존재를 알리지 않는다", async () => {
        const recipe = makeRecipe("r1", "u2");
        recipe.dismiss(NOW);
        const usecase = makeUseCase({ recipes: [recipe] });

        await expect(usecase.execute("u1", "r1")).rejects.toThrow(NotFoundException);
        expect(recipe.isDeleted()).toBe(false);
    });

    it("이미 지운 레시피를 다시 지우면 찾을 수 없다", async () => {
        const recipe = makeRecipe("r1");
        recipe.dismiss(NOW);
        const usecase = makeUseCase({ recipes: [recipe] });
        await usecase.execute("u1", "r1");

        await expect(usecase.execute("u1", "r1")).rejects.toThrow(NotFoundException);
    });
});
