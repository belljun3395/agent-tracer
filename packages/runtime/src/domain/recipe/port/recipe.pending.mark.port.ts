import type {RecipePendingMark} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";

/** 태스크 하나의 레시피 열림 표시를 로컬에 담아 두는 곳이며, 잃어도 넛지 하나를 놓칠 뿐이다. */
export interface RecipePendingMarkPort {
    read(taskId: string): readonly RecipePendingMark[];
    write(taskId: string, marks: readonly RecipePendingMark[]): void;
}
