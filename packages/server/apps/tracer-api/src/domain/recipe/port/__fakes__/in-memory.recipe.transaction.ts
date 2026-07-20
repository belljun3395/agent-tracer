import type { SearchOutboxEntity } from "@monitor/tracer-domain";
import type {
    RecipeSearchOutboxWriterPort,
    RecipeTransactionPort,
    RecipeTx,
} from "~tracer-api/domain/recipe/port/recipe.transaction.port.js";
import { InMemoryRecipeRepository } from "./in-memory.recipe.repository.js";
import { cloneRow } from "./clone-row.js";

/** 검색 아웃박스 적재의 인메모리 대역이다. */
export class InMemoryRecipeSearchOutbox implements RecipeSearchOutboxWriterPort {
    private rows = new Map<string, SearchOutboxEntity>();

    all(): readonly SearchOutboxEntity[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, SearchOutboxEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, SearchOutboxEntity>): void {
        this.rows = snapshot;
    }

    enqueue(row: SearchOutboxEntity): Promise<void> {
        this.rows.set(row.id, row);
        return Promise.resolve();
    }
}

/** 인메모리 대역 위에서 트랜잭션 경계를 재현해 실패 시 참여 저장소를 진입 시점으로 되돌린다. */
export class InMemoryRecipeTransaction implements RecipeTransactionPort {
    readonly recipes = new InMemoryRecipeRepository();
    readonly searchOutbox = new InMemoryRecipeSearchOutbox();

    async run<T>(work: (tx: RecipeTx) => Promise<T>): Promise<T> {
        const recipes = this.recipes.snapshot();
        const outbox = this.searchOutbox.snapshot();
        try {
            return await work(this);
        } catch (error) {
            this.recipes.restore(recipes);
            this.searchOutbox.restore(outbox);
            throw error;
        }
    }
}
