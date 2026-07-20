import {buildRecipeBody} from "~runtime/domain/recipe/model/recipe.body.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

/** recipeId로 캐시에서 레시피를 찾아 본문 전문을 내며 없으면 null이다. */
export class GetRecipeUsecase {
    constructor(private readonly cache: RecipeCachePort) {}

    execute(recipeId: string): string | null {
        const recipe = this.cache.load().find((candidate) => candidate.id === recipeId);
        return recipe ? buildRecipeBody(recipe) : null;
    }
}
