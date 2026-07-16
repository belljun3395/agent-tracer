import { Inject, Injectable } from "@nestjs/common";
import {
    RECIPE_APPLICATION_REPOSITORY,
    type RecipeApplicationRepositoryPort,
} from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { mapRecipeApplication, type RecipeApplicationDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

@Injectable()
export class ListRecipeApplicationsUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY)
        private readonly applications: RecipeApplicationRepositoryPort,
    ) {}

    async execute(userId: string, recipeId: string): Promise<{ readonly items: readonly RecipeApplicationDto[] } | null> {
        const recipe = await this.recipes.findById(recipeId);
        // 소유자가 아니면 존재하지 않는 것으로 취급한다.
        if (recipe === null || recipe.userId !== userId) return null;
        const apps = await this.applications.findByRecipe(recipeId);
        return { items: apps.map(mapRecipeApplication) };
    }
}
