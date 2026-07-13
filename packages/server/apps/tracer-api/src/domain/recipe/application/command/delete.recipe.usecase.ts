import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { RECIPE_SEARCH, type RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";

@Injectable()
export class DeleteRecipeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Optional()
        @Inject(RECIPE_SEARCH)
        private readonly search: RecipeSearchPort | null = null,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly deleted: boolean; readonly id: string }> {
        const recipe = await this.recipes.findById(id);
        // 소유자가 아니면 존재 여부도 노출하지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.delete(new Date());
        await this.recipes.upsert(recipe);
        await this.search?.remove(recipe.id);
        return { deleted: true, id: recipe.id };
    }
}
