import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeFetchPort} from "~runtime/domain/recipe/port/recipe.fetch.port.js";

export class InMemoryRecipeFetch implements RecipeFetchPort {
    calls: string[] = [];
    private readonly recipes = new Map<string, CachedRecipe>();
    private shouldFail = false;

    seed(recipe: CachedRecipe): void {
        this.recipes.set(recipe.id, recipe);
    }

    /** 서버 조회가 실패하는 상황을 재현한다. */
    failNext(): void {
        this.shouldFail = true;
    }

    async fetch(recipeId: string): Promise<CachedRecipe | null> {
        this.calls.push(recipeId);
        if (this.shouldFail) throw new Error("fetch failed");
        return this.recipes.get(recipeId) ?? null;
    }
}
