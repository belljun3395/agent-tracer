import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

/** 활성 레시피를 오프라인에서도 읽도록 로컬에 캐싱한다. */
export interface RecipeCachePort {
    load(): readonly CachedRecipe[];
    refresh(): Promise<boolean>;
}
