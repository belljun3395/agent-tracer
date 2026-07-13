import type { RecipeStatus } from "@monitor/kernel";
import type { RecipeEntity } from "@monitor/tracer-domain";

export const RECIPE_REPOSITORY = Symbol("RecipeRepository");

/** 레시피 애그리게이트의 조회와 저장을 제공하는 애플리케이션 포트다. */
export interface RecipeRepositoryPort {
    findById(id: string): Promise<RecipeEntity | null>;
    findByStatus(userId: string, status: RecipeStatus): Promise<RecipeEntity[]>;
    upsert(recipe: RecipeEntity): Promise<void>;
}
