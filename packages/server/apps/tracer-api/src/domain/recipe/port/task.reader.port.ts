import type { TaskEntity } from "@monitor/tracer-domain";

export const RECIPE_TASK_READER = Symbol("RecipeTaskReader");

/** 레시피 슬라이스가 인용한 태스크를 한 번에 읽는 포트다. */
export interface RecipeTaskReaderPort {
    findByIds(ids: readonly string[]): Promise<TaskEntity[]>;
}
