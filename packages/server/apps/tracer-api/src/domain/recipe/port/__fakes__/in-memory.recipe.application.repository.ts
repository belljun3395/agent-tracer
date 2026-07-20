import type { RecipeApplicationEntity } from "@monitor/tracer-domain";
import type { RecipeApplicationRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.application.repository.port.js";

/** 레시피 적용 이력 포트의 인메모리 대역이다. */
export class InMemoryRecipeApplicationRepository implements RecipeApplicationRepositoryPort {
    private readonly rows = new Map<string, RecipeApplicationEntity>();

    seed(...applications: readonly RecipeApplicationEntity[]): void {
        for (const application of applications) this.rows.set(application.id, application);
    }

    all(): readonly RecipeApplicationEntity[] {
        return [...this.rows.values()];
    }

    findByRecipe(recipeId: string): Promise<RecipeApplicationEntity[]> {
        const rows = this.all()
            .filter((application) => application.recipeId === recipeId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve(rows);
    }

    findOpenByTask(taskId: string): Promise<RecipeApplicationEntity[]> {
        const rows = this.all().filter((application) => application.taskId === taskId && application.verdict === null);
        return Promise.resolve(rows);
    }

    upsert(application: RecipeApplicationEntity): Promise<void> {
        this.rows.set(application.id, application);
        return Promise.resolve();
    }
}
