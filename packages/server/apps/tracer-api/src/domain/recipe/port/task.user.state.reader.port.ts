import type { TaskUserStateEntity } from "@monitor/tracer-domain";

export const RECIPE_TASK_USER_STATE_READER = Symbol("RecipeTaskUserStateReader");

/** 인용된 태스크의 사용자 표시 상태를 한 번에 읽는 포트다. */
export interface RecipeTaskUserStateReaderPort {
    findByIds(taskIds: readonly string[]): Promise<TaskUserStateEntity[]>;
}
