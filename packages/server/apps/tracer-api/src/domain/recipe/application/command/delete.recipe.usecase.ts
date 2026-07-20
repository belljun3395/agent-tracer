import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLOCK, type ClockPort } from "~tracer-api/domain/recipe/port/clock.port.js";
import { RECIPE_TRANSACTION, type RecipeTransactionPort, type RecipeTx } from "~tracer-api/domain/recipe/port/recipe.transaction.port.js";
import { enqueueRecipeIndex } from "~tracer-api/domain/recipe/application/recipe.support.js";

@Injectable()
export class DeleteRecipeUseCase {
    constructor(
        @Inject(RECIPE_TRANSACTION)
        private readonly tx: RecipeTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly deleted: boolean; readonly id: string }> {
        const now = this.clock.now();
        return this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
    }

    private async applyInTransaction(
        tx: RecipeTx,
        userId: string,
        id: string,
        now: Date,
    ): Promise<{ readonly deleted: boolean; readonly id: string }> {
        const recipe = await tx.recipes.findById(id);
        // 소유자가 아니면 존재 여부도 노출하지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.delete(now);
        await tx.recipes.upsert(recipe);
        // 배출기가 삭제된 레시피를 찾지 못하고 검색 문서를 지운다.
        await tx.searchOutbox.enqueue(enqueueRecipeIndex(userId, recipe.id, now));
        return { deleted: true, id: recipe.id };
    }
}
