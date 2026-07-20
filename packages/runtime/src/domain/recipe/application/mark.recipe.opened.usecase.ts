import {markRecipeOpened} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {ClockPort} from "~runtime/domain/recipe/port/clock.port.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

/** get_recipe 성공 시점을 다음 턴 넛지의 트리거로 로컬에 남긴다. */
export class MarkRecipeOpenedUsecase {
    constructor(
        private readonly marks: RecipePendingMarkPort,
        private readonly clock: ClockPort,
    ) {}

    execute(taskId: string, recipeId: string): void {
        if (taskId === "" || recipeId === "") return;
        const openedAt = new Date(this.clock.now()).toISOString();
        this.marks.write(taskId, markRecipeOpened(this.marks.read(taskId), recipeId, openedAt));
    }
}
