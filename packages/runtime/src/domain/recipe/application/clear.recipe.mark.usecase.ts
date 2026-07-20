import {clearRecipeMark} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

/** report_recipe_outcome이 그 레시피의 마크를 지워 다음 턴 넛지를 멈춘다. */
export class ClearRecipeMarkUsecase {
    constructor(private readonly marks: RecipePendingMarkPort) {}

    execute(taskId: string, recipeId: string): void {
        if (taskId === "" || recipeId === "") return;
        this.marks.write(clearRecipeMark(this.marks.read(), taskId, recipeId));
    }
}
