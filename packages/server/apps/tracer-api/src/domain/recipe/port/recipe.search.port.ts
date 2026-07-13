import type { RecipeEntity } from "@monitor/tracer-domain";

export const RECIPE_SEARCH = Symbol("RecipeSearch");

/** 레시피 검색 색인의 쓰기 작업을 제공하는 애플리케이션 포트다. */
export interface RecipeSearchPort {
    upsert(recipe: RecipeEntity): Promise<void>;
    remove(recipeId: string): Promise<void>;
}
