import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the REAL typeorm-transactional + better-sqlite3 (the global setup
// mocks the module to a no-op; we need the genuine behaviour here).
vi.unmock("typeorm-transactional");

import { DataSource, EntitySchema } from "typeorm";
import {
    Propagation,
    addTransactionalDataSource,
    initializeTransactionalContext,
    runInTransaction,
} from "typeorm-transactional";
import { serializeDataSourceWrites } from "./write-serializer.js";

interface RowShape {
    id: number;
    tag: string;
}

const Row = new EntitySchema<RowShape>({
    name: "Row",
    tableName: "rows",
    columns: {
        id: { type: "integer", primary: true },
        tag: { type: "text" },
    },
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

describe("serializeDataSourceWrites", () => {
    let ds: DataSource;

    // The transactional registry is process-global and keys on the "default"
    // datasource name (which runInTransaction resolves), so register once.
    beforeAll(async () => {
        initializeTransactionalContext();
        ds = new DataSource({ type: "better-sqlite3", database: ":memory:", entities: [Row], synchronize: true });
        await ds.initialize();
        serializeDataSourceWrites(addTransactionalDataSource(ds));
    });

    beforeEach(async () => {
        await ds.getRepository(Row).clear();
    });

    afterAll(async () => {
        await ds.destroy();
    });

    it("serializes concurrent top-level transactions instead of colliding on BEGIN", async () => {
        const repo = ds.getRepository(Row);
        // Two independent flows that each yield mid-transaction. Without
        // serialization the second BEGIN throws "cannot start a transaction
        // within a transaction"; with it, they take turns.
        await Promise.all([
            runInTransaction(async () => {
                await repo.save({ id: 1, tag: "A" });
                await tick();
                await repo.save({ id: 2, tag: "A2" });
            }),
            runInTransaction(async () => {
                await repo.save({ id: 3, tag: "B" });
                await tick();
                await repo.save({ id: 4, tag: "B2" });
            }),
        ]);
        expect((await repo.find()).map((r) => r.tag).sort()).toEqual(["A", "A2", "B", "B2"]);
    });

    it("still isolates a failed NESTED savepoint without self-deadlocking", async () => {
        const repo = ds.getRepository(Row);
        await runInTransaction(async () => {
            await repo.save({ id: 1, tag: "outer" });
            try {
                await runInTransaction(
                    async () => {
                        await repo.save({ id: 2, tag: "inner-should-rollback" });
                        throw new Error("inner boom");
                    },
                    { propagation: Propagation.NESTED },
                );
            } catch {
                // swallow — only the savepoint should roll back
            }
            await repo.save({ id: 3, tag: "outer-after" });
        });
        expect((await repo.find()).map((r) => r.tag).sort()).toEqual(["outer", "outer-after"]);
    });
});
