import {buildRecipeBody} from "~runtime/domain/recipe/model/recipe.body.model.js";
import type {RecipeFetchPort} from "~runtime/domain/recipe/port/recipe.fetch.port.js";

/** recipeId로 서버에서 레시피를 받아 본문 전문을 내며 없거나 조회가 실패하면 null이다. */
export class GetRecipeUsecase {
    constructor(private readonly fetcher: RecipeFetchPort) {}

    async execute(recipeId: string): Promise<string | null> {
        try {
            const recipe = await this.fetcher.fetch(recipeId);
            return recipe ? buildRecipeBody(recipe) : null;
        } catch {
            return null;
        }
    }
}
