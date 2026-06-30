import type { RecipeStatus } from "@monitor/insight-api/domain/recipe/const/recipe.const.js";
import type { RecipeDto } from "@monitor/insight-api/application/recipe/dto/recipe.usecase.dto.js";

export interface ListRecipesUseCaseIn {
    readonly status?: RecipeStatus | "all";
}

export interface ListRecipesUseCaseOut {
    readonly recipes: readonly RecipeDto[];
}
