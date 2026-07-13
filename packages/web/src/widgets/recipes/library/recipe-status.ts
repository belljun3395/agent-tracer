import type { Recipe } from "~web/entities/recipe/model/recipe.js";

// 활성도 후보도 아닌 recipe 는 보관함(archive)으로 본다.
/** 레시피의 라이브러리 보관 상태를 판정한다. */
export function isArchivedRecipe(recipe: Recipe): boolean {
  return recipe.status !== "active" && recipe.status !== "candidate";
}

// 서버 RecipeEntity.canDelete()의 짝.
export function canDeleteRecipe(recipe: Recipe): boolean {
  return recipe.status === "dismissed" || recipe.status === "retired";
}
