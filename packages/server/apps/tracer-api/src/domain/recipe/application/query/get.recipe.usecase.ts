import { Inject, Injectable } from "@nestjs/common";
import { RecipeLifecycle, type RecipeStats } from "@monitor/tracer-domain";
import {
    RECIPE_APPLICATION_REPOSITORY,
    type RecipeApplicationRepositoryPort,
} from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { mapRecipe, mapRecipeApplication, type RecipeApplicationDto, type RecipeDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

export interface RecipeDetail {
    readonly recipe: RecipeDto;
    readonly stats: RecipeStats;
    readonly applications: readonly RecipeApplicationDto[];
}

@Injectable()
export class GetRecipeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY)
        private readonly applications: RecipeApplicationRepositoryPort,
    ) {}

    async execute(userId: string, id: string): Promise<RecipeDetail | null> {
        const recipe = await this.recipes.findById(id);
        // 소유자가 아니면 존재하지 않는 것으로 취급한다.
        if (recipe === null || recipe.userId !== userId) return null;
        const apps = await this.applications.findByRecipe(id);
        return {
            recipe: mapRecipe(recipe),
            stats: new RecipeLifecycle(recipe, apps).stats(),
            applications: apps.map(mapRecipeApplication),
        };
    }
}
