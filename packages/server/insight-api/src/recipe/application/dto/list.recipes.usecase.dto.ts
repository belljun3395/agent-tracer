import type { RecipeStatus } from "@monitor/insight-api/recipe/domain/recipe.entity.js";
import type { RecipeDto } from "./recipe.usecase.dto.js";

export interface ListRecipesUseCaseIn {
    readonly status?: RecipeStatus | "all";
}

export interface ListRecipesUseCaseOut {
    readonly recipes: readonly RecipeDto[];
}
