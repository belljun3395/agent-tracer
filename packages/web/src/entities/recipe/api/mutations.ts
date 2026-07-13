import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  acceptRecipe,
  deleteRecipe,
  dismissRecipe,
  editRecipe,
  retireRecipe,
} from "~web/entities/recipe/api/api-recipes.js";
import type { RecipeEditInput } from "~web/entities/recipe/model/recipe.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useAcceptRecipeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => acceptRecipe(recipeId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.recipesPrefix() });
    },
  });
}

export function useDismissRecipeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => dismissRecipe(recipeId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.recipesPrefix() });
    },
  });
}

export function useRetireRecipeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => retireRecipe(recipeId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.recipesPrefix() });
    },
  });
}

export function useDeleteRecipeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(recipeId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.recipesPrefix() });
    },
  });
}

export function useEditRecipeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, body }: { readonly recipeId: string; readonly body: RecipeEditInput }) =>
      editRecipe(recipeId, body),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.recipesPrefix() });
    },
  });
}
