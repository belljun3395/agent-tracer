import {
    PENDING_MARK_TTL_MS,
    dropExpiredMarks,
    type RecipePendingMark,
} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {ClockPort} from "~runtime/domain/recipe/port/clock.port.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

/** UserPromptSubmit이 이 태스크에 아직 보고되지 않은 가장 오래된 레시피가 있는지 묻는다. */
export class ReadPendingRecipeMarkUsecase {
    constructor(
        private readonly marks: RecipePendingMarkPort,
        private readonly clock: ClockPort,
    ) {}

    execute(taskId: string): RecipePendingMark | undefined {
        if (taskId === "") return undefined;
        const marks = this.marks.read(taskId);
        const alive = dropExpiredMarks(marks, this.clock.now(), PENDING_MARK_TTL_MS);
        if (alive.length !== marks.length) this.marks.write(taskId, alive);
        return alive[0];
    }
}
