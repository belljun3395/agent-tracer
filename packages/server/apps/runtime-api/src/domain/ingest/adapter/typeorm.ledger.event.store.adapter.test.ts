import { describe, expect, it, vi } from "vitest";
import { DataSource, InsertQueryBuilder, InsertResult } from "typeorm";
import { KIND } from "@monitor/kernel";
import type { LedgerEventRecord } from "~runtime-api/domain/ingest/port/ledger.event.store.port.js";
import { TypeOrmLedgerEventStoreAdapter } from "./typeorm.ledger.event.store.adapter.js";

function event(id: string, occurredAt: string): LedgerEventRecord {
    return {
        id,
        userId: "user-1",
        taskId: "task-1",
        sessionId: "session-1",
        kind: KIND.executeTool,
        occurredAt: new Date(occurredAt),
        traceId: "trace-1",
        spanId: `span-${id}`,
        parentSpanId: null,
        payload: { title: "event" },
    };
}

function builder(execute: () => Promise<unknown>) {
    const chain = {
        insert: vi.fn(() => chain),
        into: vi.fn((_value: unknown) => chain),
        values: vi.fn((_value: unknown) => chain),
        orIgnore: vi.fn(() => chain),
        returning: vi.fn((_value: unknown) => chain),
        execute: vi.fn(execute),
    };
    return chain;
}

describe("TypeOrmLedgerEventStoreAdapter", () => {
    it("수집 키 claim SQL이 새로 잡은 ID를 돌려받게 한다", async () => {
        const queryDataSource = new DataSource({
            type: "postgres",
            host: "127.0.0.1",
            database: "runtime",
            username: "monitor",
            password: "monitor",
        });
        let claimQuery = "";
        const execute = vi.spyOn(InsertQueryBuilder.prototype, "execute")
            .mockImplementation(async function (this: InsertQueryBuilder<object>) {
                claimQuery = this.getQuery();
                const result = new InsertResult();
                result.raw = [];
                return result;
            });
        const manager = { createQueryBuilder: () => queryDataSource.createQueryBuilder() };
        const dataSource = {
            transaction: async (run: (value: typeof manager) => Promise<void>) => run(manager),
        } as unknown as DataSource;

        try {
            await new TypeOrmLedgerEventStoreAdapter(dataSource).appendAll([
                event("event-1", "2026-07-10T00:00:00.000Z"),
            ]);
        } finally {
            execute.mockRestore();
        }

        expect(claimQuery).toContain("RETURNING id");
    });

    it("occurredAt이 달라도 같은 ID의 배치 내 중복을 한 번만 append한다", async () => {
        const claim = builder(vi.fn()
            .mockResolvedValueOnce({ raw: [{ id: "event-1" }] })
            .mockResolvedValueOnce({ raw: [] }));
        const append = builder(async () => ({ raw: [] }));
        const manager = {
            createQueryBuilder: () => claim,
            getRepository: () => ({ createQueryBuilder: () => append }),
        };
        const dataSource = {
            transaction: async (run: (value: typeof manager) => Promise<void>) => run(manager),
        } as unknown as DataSource;
        const store = new TypeOrmLedgerEventStoreAdapter(dataSource);

        await store.appendAll([
            event("event-1", "2026-07-10T00:00:00.000Z"),
            event("event-1", "2026-07-10T00:00:01.000Z"),
        ]);
        await store.appendAll([event("event-1", "2026-07-10T00:00:02.000Z")]);

        expect(claim.values.mock.calls[0]?.[0]).toEqual([{ id: "event-1" }]);
        expect(append.values).toHaveBeenCalledOnce();
        expect(append.values.mock.calls[0]?.[0]).toHaveLength(1);
    });

    it("멱등 보증 윈도 안에서 같은 ID를 재전송해도 중복 저장하지 않는다", async () => {
        const claim = builder(vi.fn()
            .mockResolvedValueOnce({ raw: [{ id: "event-1" }] })
            .mockResolvedValueOnce({ raw: [] }));
        const append = builder(async () => ({ raw: [] }));
        const manager = {
            createQueryBuilder: () => claim,
            getRepository: () => ({ createQueryBuilder: () => append }),
        };
        const dataSource = {
            transaction: async (run: (value: typeof manager) => Promise<void>) => run(manager),
        } as unknown as DataSource;
        const store = new TypeOrmLedgerEventStoreAdapter(dataSource);

        await store.appendAll([event("event-1", "2026-07-10T00:00:00.000Z")]);
        await store.appendAll([event("event-1", "2026-07-10T00:00:00.000Z")]);

        expect(claim.execute).toHaveBeenCalledTimes(2);
        expect(append.values).toHaveBeenCalledOnce();
    });

    it("원장 append 실패를 트랜잭션 밖으로 전파해 claim도 되돌리게 한다", async () => {
        const claim = builder(async () => ({ raw: [{ id: "event-1" }] }));
        const append = builder(async () => {
            throw new Error("ledger insert failed");
        });
        const manager = {
            createQueryBuilder: () => claim,
            getRepository: () => ({ createQueryBuilder: () => append }),
        };
        let rolledBack = false;
        const dataSource = {
            transaction: async (run: (value: typeof manager) => Promise<void>) => {
                try {
                    await run(manager);
                } catch (error) {
                    rolledBack = true;
                    throw error;
                }
            },
        } as unknown as DataSource;
        const store = new TypeOrmLedgerEventStoreAdapter(dataSource);

        await expect(store.appendAll([event("event-1", "2026-07-10T00:00:00.000Z")]))
            .rejects.toThrow("ledger insert failed");
        expect(rolledBack).toBe(true);
    });
});
