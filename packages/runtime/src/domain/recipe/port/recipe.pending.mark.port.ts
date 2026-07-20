import type {RecipePendingMarkStore} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";

/** 레시피 열림 표시를 로컬에 담아 두는 곳이며, 잃어도 넛지 하나를 놓칠 뿐이다. */
export interface RecipePendingMarkPort {
    read(): RecipePendingMarkStore;
    write(store: RecipePendingMarkStore): void;
}
