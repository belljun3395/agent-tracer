import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeFetchPort} from "~runtime/domain/recipe/port/recipe.fetch.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

export class InMemoryRecipeFetch implements RecipeFetchPort {
    calls: string[] = [];
    private readonly recipes = new Map<string, CachedRecipe>();
    private nextThrows = false;
    private nextUnavailable = false;

    seed(recipe: CachedRecipe): void {
        this.recipes.set(recipe.id, recipe);
    }

    /** 서버 조회가 예외로 튀는 상황을 재현한다. */
    failNext(): void {
        this.nextThrows = true;
    }

    /** 서버 접속은 됐지만 확답을 못 받은 상황을 재현한다. */
    respondUnavailableNext(): void {
        this.nextUnavailable = true;
    }

    async fetch(recipeId: string): Promise<Fetched<CachedRecipe>> {
        this.calls.push(recipeId);
        if (this.nextThrows) throw new Error("fetch failed");
        if (this.nextUnavailable) return {kind: "unavailable"};
        const recipe = this.recipes.get(recipeId);
        return recipe === undefined ? {kind: "absent"} : {kind: "found", value: recipe};
    }
}
