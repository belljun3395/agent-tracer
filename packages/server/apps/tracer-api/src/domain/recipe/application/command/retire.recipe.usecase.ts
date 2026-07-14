import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { CLOCK, type ClockPort } from "~tracer-api/domain/recipe/port/clock.port.js";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { RECIPE_SEARCH, type RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { mapRecipe, type RecipeDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

@Injectable()
export class RetireRecipeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
        @Optional()
        @Inject(RECIPE_SEARCH)
        private readonly search: RecipeSearchPort | null = null,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly recipe: RecipeDto }> {
        const recipe = await this.recipes.findById(id);
        // 소유자가 아니면 존재 여부도 노출하지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.retire(this.clock.now());
        await this.recipes.upsert(recipe);
        await this.search?.upsert(recipe);
        return { recipe: mapRecipe(recipe) };
    }
}
