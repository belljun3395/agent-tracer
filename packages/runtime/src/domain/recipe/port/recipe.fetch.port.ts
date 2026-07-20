import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

/** 레시피 하나를 recipeId로 서버에서 직접 가져오는 아웃바운드 포트이며 없거나 실패하면 null이다. */
export interface RecipeFetchPort {
    fetch(recipeId: string): Promise<CachedRecipe | null>;
}
