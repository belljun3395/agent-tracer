import type {RecipePendingMarkStore} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

export class InMemoryRecipePendingMarkStore implements RecipePendingMarkPort {
    private store: RecipePendingMarkStore = {};

    read(): RecipePendingMarkStore {
        return this.store;
    }

    write(store: RecipePendingMarkStore): void {
        this.store = store;
    }
}
