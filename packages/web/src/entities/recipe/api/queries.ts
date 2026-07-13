import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchRecipes } from "~web/entities/recipe/api/api-recipes.js";
import type { RecipesResponse, RecipeStatusFilter } from "~web/entities/recipe/model/recipe.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useRecipesQuery(
  status: RecipeStatusFilter = "active",
): UseQueryResult<RecipesResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.recipes(status),
    queryFn: () => fetchRecipes(status),
  });
}
