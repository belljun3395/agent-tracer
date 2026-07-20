import {pendingRecipeMarkFor, type RecipePendingMark} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

/** UserPromptSubmit이 이 태스크에 아직 보고되지 않은 레시피가 있는지 묻는다. */
export class ReadPendingRecipeMarkUsecase {
    constructor(private readonly marks: RecipePendingMarkPort) {}

    execute(taskId: string): RecipePendingMark | undefined {
        if (taskId === "") return undefined;
        return pendingRecipeMarkFor(this.marks.read(), taskId);
    }
}
