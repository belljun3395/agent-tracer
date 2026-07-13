import type { RecipeStatus } from "@monitor/kernel";
import type { RecipeEntity } from "@monitor/tracer-domain";
import type { RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";

/** 저장소 포트의 인메모리 대역이다. */
export class InMemoryRecipeRepository implements RecipeRepositoryPort {
    private readonly rows = new Map<string, RecipeEntity>();

    seed(...recipes: readonly RecipeEntity[]): void {
        for (const recipe of recipes) this.rows.set(recipe.id, recipe);
    }

    all(): readonly RecipeEntity[] {
        return [...this.rows.values()];
    }

    findById(id: string): Promise<RecipeEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findByStatus(userId: string, status: RecipeStatus): Promise<RecipeEntity[]> {
        return Promise.resolve(this.all().filter((r) => r.userId === userId && r.status === status));
    }

    upsert(recipe: RecipeEntity): Promise<void> {
        this.rows.set(recipe.id, recipe);
        return Promise.resolve();
    }
}
