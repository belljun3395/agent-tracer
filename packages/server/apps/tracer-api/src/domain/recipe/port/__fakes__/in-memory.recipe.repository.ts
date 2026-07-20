import type { RecipeStatus } from "@monitor/kernel";
import type { RecipeEntity } from "@monitor/tracer-domain";
import type { RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";
import { cloneRow } from "./clone-row.js";

/** 저장소 포트의 인메모리 대역이다. */
export class InMemoryRecipeRepository implements RecipeRepositoryPort {
    private rows = new Map<string, RecipeEntity>();

    seed(...recipes: readonly RecipeEntity[]): void {
        for (const recipe of recipes) this.rows.set(recipe.id, recipe);
    }

    all(): readonly RecipeEntity[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, RecipeEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, RecipeEntity>): void {
        this.rows = snapshot;
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
