import type {RecipePendingMark} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

export class InMemoryRecipePendingMarkStore implements RecipePendingMarkPort {
    writeCalls: string[] = [];
    private readonly store = new Map<string, readonly RecipePendingMark[]>();

    read(taskId: string): readonly RecipePendingMark[] {
        return [...(this.store.get(taskId) ?? [])];
    }

    write(taskId: string, marks: readonly RecipePendingMark[]): void {
        this.writeCalls.push(taskId);
        this.store.set(taskId, [...marks]);
    }
}
