import type { RecipeApplicationEntity } from "@monitor/tracer-domain";

export const RECIPE_APPLICATION_REPOSITORY = Symbol("RecipeApplicationRepository");

/** 레시피 적용 이력의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface RecipeApplicationRepositoryPort {
    findByRecipe(recipeId: string): Promise<RecipeApplicationEntity[]>;
    findByTask(taskId: string): Promise<RecipeApplicationEntity[]>;
    upsert(application: RecipeApplicationEntity): Promise<void>;
}
