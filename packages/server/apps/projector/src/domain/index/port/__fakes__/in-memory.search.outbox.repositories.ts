import type { RecipeEntity, SearchOutboxEntity, TaskUserStateEntity } from "@monitor/tracer-domain";
import type {
    SearchOutboxRecipeRepository,
    SearchOutboxRepositoryPort,
    SearchOutboxTaskUserStateRepository,
} from "~projector/domain/index/port/search.outbox.drain.repository.port.js";

/** 검색 아웃박스 큐 포트의 인메모리 대역이다. */
export class InMemorySearchOutboxRepository implements SearchOutboxRepositoryPort {
    private rows: SearchOutboxEntity[] = [];
    readonly failures: { readonly id: string; readonly attempts: number; readonly error: string }[] = [];

    seed(...rows: readonly SearchOutboxEntity[]): void {
        this.rows.push(...rows);
    }

    pending(): readonly SearchOutboxEntity[] {
        return [...this.rows];
    }

    findBatch(limit: number): Promise<SearchOutboxEntity[]> {
        return Promise.resolve(this.rows.slice(0, limit));
    }

    delete(id: string): Promise<void> {
        this.rows = this.rows.filter((row) => row.id !== id);
        return Promise.resolve();
    }

    markFailed(id: string, attempts: number, error: string): Promise<void> {
        this.failures.push({ id, attempts, error });
        return Promise.resolve();
    }
}

/** 레시피 조회 포트의 인메모리 대역이다. */
export class InMemorySearchOutboxRecipeRepository implements SearchOutboxRecipeRepository {
    private readonly rows = new Map<string, RecipeEntity>();

    seed(...recipes: readonly RecipeEntity[]): void {
        for (const recipe of recipes) this.rows.set(recipe.id, recipe);
    }

    findById(id: string): Promise<RecipeEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }
}

/** 태스크 사용자 상태 조회 포트의 인메모리 대역이다. */
export class InMemorySearchOutboxTaskUserStateRepository implements SearchOutboxTaskUserStateRepository {
    private readonly rows = new Map<string, TaskUserStateEntity>();

    seed(...states: readonly TaskUserStateEntity[]): void {
        for (const state of states) this.rows.set(state.taskId, state);
    }

    findById(id: string): Promise<TaskUserStateEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }
}
