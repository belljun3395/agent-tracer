import { Injectable } from "@nestjs/common";
import { RecipeApplicationRepository } from "@monitor/insight-api/repository/recipe/recipe.application.repository.js";

/** taskId로 적용된 recipe application 목록을 조회한다. */
@Injectable()
export class ListRecipeApplicationsUseCase {
    constructor(private readonly applications: RecipeApplicationRepository) {}

    async execute(taskId: string) {
        const rows = await this.applications.listByTaskId(taskId);
        return {
            applications: rows.map((r) => ({
                id: r.id,
                recipeId: r.recipeId,
                targetTaskId: r.targetTaskId,
                injectedVia: r.injectedVia,
                score: r.score,
                outcome: r.outcome,
                createdAt: r.createdAt,
                resolvedAt: r.resolvedAt,
            })),
        };
    }
}
