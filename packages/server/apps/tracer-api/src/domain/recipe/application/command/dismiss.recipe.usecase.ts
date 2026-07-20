import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RecipeEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/recipe/port/clock.port.js";
import { RECIPE_TRANSACTION, type RecipeTransactionPort, type RecipeTx } from "~tracer-api/domain/recipe/port/recipe.transaction.port.js";
import { enqueueRecipeIndex, mapRecipe, type RecipeDto } from "~tracer-api/domain/recipe/application/recipe.support.js";

@Injectable()
export class DismissRecipeUseCase {
    constructor(
        @Inject(RECIPE_TRANSACTION)
        private readonly tx: RecipeTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly recipe: RecipeDto }> {
        const now = this.clock.now();
        const recipe = await this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
        return { recipe: mapRecipe(recipe) };
    }

    private async applyInTransaction(tx: RecipeTx, userId: string, id: string, now: Date): Promise<RecipeEntity> {
        const recipe = await tx.recipes.findById(id);
        // 소유자가 아니면 존재 여부도 노출하지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.dismiss(now);
        await tx.recipes.upsert(recipe);
        await tx.searchOutbox.enqueue(enqueueRecipeIndex(userId, recipe.id, now));
        return recipe;
    }
}
