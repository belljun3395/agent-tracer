import type { RecipeApplicationEntity, RecipeEntity } from "@monitor/tracer-domain";

/** 노후 레시피 회수가 사용하는 레시피 저장소 포트다. */
export interface RecipeRetireReaperRecipeRepository {
    findStaleActiveCandidates(before: Date, limit: number): Promise<RecipeEntity[]>;
    upsert(recipe: RecipeEntity): Promise<void>;
}

/** 후보 레시피가 실제로 한 번도 당겨지지 않았는지 확인하는 적용 이력 저장소 포트다. */
export interface RecipeRetireReaperApplicationRepository {
    findByRecipe(recipeId: string): Promise<RecipeApplicationEntity[]>;
}

/** 회수 트랜잭션 안에서 레시피 노후 회수가 사용하는 저장소 경계다. */
export interface RecipeRetireReaperRepositories {
    readonly recipes: RecipeRetireReaperRecipeRepository;
    readonly recipeApplications: RecipeRetireReaperApplicationRepository;
}
