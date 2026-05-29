import { AsyncLocalStorage } from "node:async_hooks";
import type { DataSource } from "typeorm";

/**
 * Serialize top-level transactions on the single better-sqlite3 connection.
 *
 * better-sqlite3 exposes ONE connection, on which only one transaction can be
 * open at a time. TypeORM's better-sqlite3 driver caches a single queryRunner
 * and increments its `transactionDepth` AFTER awaiting `BEGIN`, and its async
 * `query()` awaits `connect()` before each statement — so two transactional
 * flows that interleave across those awaits both observe depth 0, both issue
 * `BEGIN`, and the second throws `SqliteError: cannot start a transaction
 * within a transaction` (and, worse, writes can bleed across the two flows).
 *
 * Every top-level `@Transactional()` / `runInTransaction()` ultimately calls
 * `dataSource.transaction()`, so we wrap that single funnel with a re-entrant
 * async mutex: concurrent top-level transactions take turns, while a NESTED /
 * REQUIRES_NEW savepoint — which re-enters `dataSource.transaction()` from
 * within the same async context that already holds the lock — passes through
 * inline instead of re-acquiring (which would self-deadlock).
 */
type TransactionFn = DataSource["transaction"];

export function serializeDataSourceWrites(dataSource: DataSource): DataSource {
    const original = dataSource.transaction.bind(dataSource) as (
        ...args: readonly unknown[]
    ) => Promise<unknown>;
    // Marks the async context that currently holds the lock, so nested
    // savepoints opened during that transaction are recognised and not re-locked.
    const holdsLock = new AsyncLocalStorage<true>();
    // Single-lane promise chain = a fair FIFO async mutex.
    let tail: Promise<unknown> = Promise.resolve();

    const runExclusive = (args: readonly unknown[]): Promise<unknown> => {
        const result = tail.then(() => holdsLock.run(true, () => original(...args)));
        // Keep the lane alive regardless of this transaction's outcome.
        tail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    };

    const wrapped = ((...args: readonly unknown[]): Promise<unknown> => {
        if (holdsLock.getStore()) {
            // Nested savepoint inside an already-held transaction — run inline.
            return original(...args);
        }
        return runExclusive(args);
    }) as TransactionFn;

    dataSource.transaction = wrapped;
    return dataSource;
}
