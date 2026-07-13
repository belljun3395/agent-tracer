import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

export class InMemoryRecipeCache implements RecipeCachePort {
    refreshCount = 0;

    constructor(private readonly recipes: readonly CachedRecipe[] = []) {}

    load(): readonly CachedRecipe[] {
        return this.recipes;
    }

    async refresh(): Promise<boolean> {
        this.refreshCount += 1;
        return true;
    }
}
