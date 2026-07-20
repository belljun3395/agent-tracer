import { describe, expect, it } from "vitest";
import { MAX_SEARCH_LIMIT } from "~tracer-api/support/search.limit.js";
import type { RecipeSearchHit, RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { SearchRecipesUseCase } from "./search.recipes.usecase.js";

interface Call {
    readonly userId: string;
    readonly q: string;
    readonly limit: number;
}

function makeUseCase(hits: readonly RecipeSearchHit[] = []): { useCase: SearchRecipesUseCase; calls: Call[] } {
    const calls: Call[] = [];
    const search = {
        search: async (userId: string, q: string, limit: number) => {
            calls.push({ userId, q, limit });
            return hits;
        },
    } satisfies RecipeSearchPort;
    return { useCase: new SearchRecipesUseCase(search), calls };
}

describe("SearchRecipesUseCase", () => {
    it("검색어가 공백뿐이면 색인을 조회하지 않고 빈 결과를 낸다", async () => {
        const { useCase, calls } = makeUseCase();

        const result = await useCase.execute({ userId: "u1", q: "   " });

        expect(result).toEqual({ items: [] });
        expect(calls).toEqual([]);
    });

    it("limit을 넘기지 않으면 기본값 3으로 조회한다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1", q: "린트" });

        expect(calls[0]?.limit).toBe(3);
    });

    it("상한을 넘는 limit은 10으로 접어 전역 상한보다 낮춘다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1", q: "린트", limit: MAX_SEARCH_LIMIT });

        expect(calls[0]?.limit).toBe(10);
    });

    it("검색 히트를 결정 수준 필드만 담아 매핑한다", async () => {
        const hit: RecipeSearchHit = {
            id: "r1",
            title: "lint pipeline",
            intent: "린트 전에 부른다",
            description: "설명",
            status: "active",
            userEdited: false,
            score: 4.2,
        };
        const { useCase } = makeUseCase([hit]);

        const result = await useCase.execute({ userId: "u1", q: "린트" });

        expect(result.items).toEqual([
            { recipeId: "r1", title: "lint pipeline", intent: "린트 전에 부른다", description: "설명", score: 4.2 },
        ]);
    });
});
