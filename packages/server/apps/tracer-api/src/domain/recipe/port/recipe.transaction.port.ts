import type { SearchOutboxEntity } from "@monitor/tracer-domain";
import type { RecipeRepositoryPort } from "~tracer-api/domain/recipe/port/recipe.repository.port.js";

export const RECIPE_TRANSACTION = Symbol("RecipeTransaction");

/** 같은 커밋에 검색 반영 요청을 남기는 포트다. */
export interface RecipeSearchOutboxWriterPort {
    enqueue(row: SearchOutboxEntity): Promise<void>;
}

/** 한 커밋 안에서만 유효한 레시피 저장소 묶음이다. */
export interface RecipeTx {
    readonly recipes: RecipeRepositoryPort;
    readonly searchOutbox: RecipeSearchOutboxWriterPort;
}

/** 레시피 쓰기와 검색 아웃박스 적재를 한 커밋으로 묶어 실행하는 포트다. */
export interface RecipeTransactionPort {
    run<T>(work: (tx: RecipeTx) => Promise<T>): Promise<T>;
}
