import type { ObjectLiteral } from "typeorm";
import type { TracerTx, TransactionRunner } from "../persistence/transaction.runner.js";
import type { InMemoryRepository } from "./in-memory-repository.js";

/** 인메모리 대역 위에서 트랜잭션 경계를 재현해 실패 시 참여 저장소를 진입 시점으로 되돌린다. */
export function createFakeTransactionRunner(
    tx: TracerTx,
    stores: readonly InMemoryRepository<ObjectLiteral>[],
): TransactionRunner {
    return {
        async run<T>(work: (tx: TracerTx) => Promise<T>): Promise<T> {
            const snapshots = stores.map((store) => store.snapshot());
            try {
                return await work(tx);
            } catch (error) {
                stores.forEach((store, index) => store.restore(snapshots[index] ?? []));
                throw error;
            }
        },
    } as unknown as TransactionRunner;
}
