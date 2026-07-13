import { matchRecipes } from "@monitor/kernel";
import type { RecipeMatch } from "@monitor/kernel";
import type { RecipeEntity } from "./recipe.entity.js";

/** 프롬프트와 토큰 겹침으로 활성 레시피를 점수화해 상위 매칭을 고른다. */
export class RecipeMatching {
    constructor(private readonly recipes: readonly RecipeEntity[]) {}

    match(prompt: string, limit: number): RecipeMatch[] {
        return matchRecipes(prompt, this.recipes.filter((recipe) => recipe.isActive()), limit);
    }
}
