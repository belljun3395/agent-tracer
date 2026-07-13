import type {
  RecipeEditInput,
  RecipesResponse,
  RecipeStatusFilter,
} from "~web/entities/recipe/model/recipe.js";
import type { RecipeDto, RecipeWithStatsDto } from "@monitor/kernel";
import { deleteRequest, getJson, patchJson, postJson } from "~web/shared/api/client/json-methods.js";
import { toRecipe } from "~web/entities/recipe/api/recipe.mapper.js";

export async function fetchRecipes(
  status: RecipeStatusFilter = "active",
): Promise<RecipesResponse> {
  // 서버는 구체적인 RecipeStatus만 받는다. "all"은 파라미터를 생략해서
  // 표현하며, 리터럴 문자열 "all"을 보내면 거부된다(400).
  const qs = status === "all" ? "" : `?status=${status}`;
  const res = await getJson<{
    readonly items: readonly RecipeWithStatsDto[];
    readonly taskTitles: Readonly<Record<string, string>>;
  }>(`/api/v1/recipes${qs}`);
  return {
    recipes: res.items.map(toRecipe),
    taskTitleById: new Map(Object.entries(res.taskTitles)),
  };
}

export function acceptRecipe(
  recipeId: string,
): Promise<{ readonly recipe: RecipeDto }> {
  return postJson<{ readonly recipe: RecipeDto }>(
    `/api/v1/recipes/${encodeURIComponent(recipeId)}/accept`,
  );
}

export function dismissRecipe(
  recipeId: string,
): Promise<{ readonly recipe: RecipeDto }> {
  return postJson<{ readonly recipe: RecipeDto }>(
    `/api/v1/recipes/${encodeURIComponent(recipeId)}/dismiss`,
  );
}

export function retireRecipe(
  recipeId: string,
): Promise<{ readonly recipe: RecipeDto }> {
  return postJson<{ readonly recipe: RecipeDto }>(
    `/api/v1/recipes/${encodeURIComponent(recipeId)}/retire`,
  );
}

export function deleteRecipe(
  recipeId: string,
): Promise<{ readonly deleted: boolean; readonly id: string }> {
  return deleteRequest<{ readonly deleted: boolean; readonly id: string }>(
    `/api/v1/recipes/${encodeURIComponent(recipeId)}`,
  );
}

export function editRecipe(
  recipeId: string,
  body: RecipeEditInput,
): Promise<{ readonly recipe: RecipeDto }> {
  return patchJson<{ readonly recipe: RecipeDto }>(
    `/api/v1/recipes/${encodeURIComponent(recipeId)}`,
    body,
  );
}
