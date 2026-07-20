import type {Fetched} from "~runtime/support/fetched.js";
import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

/** 레시피 하나를 recipeId로 서버에서 직접 가져오는 아웃바운드 포트이며 없음과 접속 실패를 구분해 낸다. */
export interface RecipeFetchPort {
    fetch(recipeId: string): Promise<Fetched<CachedRecipe>>;
}
