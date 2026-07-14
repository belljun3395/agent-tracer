import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RecipeRevisionInput } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/recipe/port/clock.port.js";
import { RECIPE_REPOSITORY, type RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { RECIPE_SEARCH, type RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { mapRecipe, type RecipeDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

export interface EditRecipeInput {
    readonly title?: string | undefined;
    readonly intent?: string | undefined;
    readonly description?: string | undefined;
    readonly summaryMd?: string | undefined;
}

@Injectable()
export class EditRecipeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY)
        private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_SEARCH) private readonly search: RecipeSearchPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string, input: EditRecipeInput): Promise<{ readonly recipe: RecipeDto }> {
        const recipe = await this.recipes.findById(id);
        // 소유자가 아니면 존재 여부도 노출하지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.editByUser(toRevision(input), this.clock.now());
        await this.recipes.upsert(recipe);
        await this.search.upsert(recipe);
        return { recipe: mapRecipe(recipe) };
    }
}

function toRevision(input: EditRecipeInput): RecipeRevisionInput {
    return {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.intent !== undefined ? { intent: input.intent } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.summaryMd !== undefined ? { summaryMd: input.summaryMd } : {}),
    };
}
