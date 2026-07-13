import { Inject, Injectable } from "@nestjs/common";
import {
    RECIPE_APPLICATION_REPOSITORY,
    type RecipeApplicationRepositoryPort,
} from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";
import { mapRecipeApplication, type RecipeApplicationDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

@Injectable()
export class ListRecipeApplicationsUseCase {
    constructor(
        @Inject(RECIPE_APPLICATION_REPOSITORY)
        private readonly applications: RecipeApplicationRepositoryPort,
    ) {}

    async execute(recipeId: string): Promise<{ readonly items: readonly RecipeApplicationDto[] }> {
        const apps = await this.applications.findByRecipe(recipeId);
        return { items: apps.map(mapRecipeApplication) };
    }
}
