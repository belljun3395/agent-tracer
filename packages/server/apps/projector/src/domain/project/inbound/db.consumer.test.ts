import { describe, expect, it, vi } from "vitest";
import { KIND, TOPIC } from "@monitor/kernel";
import type { KafkaConsumer, KafkaEachBatchPayload } from "@monitor/platform";
import type { ApplyLedgerBatchUseCase } from "~projector/domain/project/application/apply.ledger.batch.usecase.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { DbConsumer } from "./db.consumer.js";

interface ConsumerHarness {
    readonly consumer: DbConsumer;
    readonly connect: ReturnType<typeof vi.fn>;
    readonly subscribe: ReturnType<typeof vi.fn>;
    readonly projected: string[];
    batch(): (payload: KafkaEachBatchPayload) => Promise<void>;
}

function ledgerRow(seq: number): Buffer {
    return Buffer.from(JSON.stringify({
        id: `event-${seq}`,
        seq,
        user_id: "user-1",
        task_id: "task-1",
        session_id: null,
        kind: KIND.userMessage,
        occurred_at: "2026-07-10T00:00:00.000Z",
        received_at: "2026-07-10T00:00:01.000Z",
        trace_id: "0123456789abcdef0123456789abcdef",
        span_id: "0123456789abcdef",
        payload: {},
    }));
}

function batchPayload(values: readonly (Buffer | null)[], heartbeat: () => Promise<void>): KafkaEachBatchPayload {
    return {
        batch: {
            topic: TOPIC.ingestEvents,
            partition: 0,
            messages: values.map((value, index) => ({ offset: String(index), value })),
        },
        heartbeat,
    } as unknown as KafkaEachBatchPayload;
}

function harness(failAtSeq?: string): ConsumerHarness {
    let eachBatch: ((payload: KafkaEachBatchPayload) => Promise<void>) | undefined;
    const connect = vi.fn(async () => undefined);
    const subscribe = vi.fn(async () => undefined);
    const kafka = {
        connect,
        subscribe,
        run: vi.fn(async (config: { eachBatch: (payload: KafkaEachBatchPayload) => Promise<void> }) => {
            eachBatch = config.eachBatch;
        }),
        disconnect: vi.fn(async () => undefined),
    } as unknown as KafkaConsumer;
    const projected: string[] = [];
    const applyLedgerBatch = {
        execute: vi.fn(async (records: Iterable<LedgerRecord>, recordProjected: () => Promise<void>) => {
            for (const record of records) {
                projected.push(record.seq);
                if (record.seq === failAtSeq) throw new Error("projection failed");
                await recordProjected();
            }
        }),
    } as unknown as ApplyLedgerBatchUseCase;
    const consumer = new DbConsumer(kafka, applyLedgerBatch);
    return {
        consumer,
        connect,
        subscribe,
        projected,
        batch: () => {
            if (eachBatch === undefined) throw new Error("consumer was not started");
            return eachBatch;
        },
    };
}

describe("DbConsumer", () => {
    it("메시지를 순서대로 해석해 배치 유스케이스에 넘기고 유효한 레코드 25건마다 heartbeat한다", async () => {
        const target = harness();
        await target.consumer.start();
        const heartbeatAt: number[] = [];
        const heartbeat = vi.fn(async () => {
            heartbeatAt.push(target.projected.length);
        });
        const values = [Buffer.from("invalid"), ...Array.from({ length: 26 }, (_, index) => ledgerRow(index + 1))];

        await target.batch()(batchPayload(values, heartbeat));

        expect(target.connect).toHaveBeenCalledOnce();
        expect(target.subscribe).toHaveBeenCalledWith({ topics: [TOPIC.ingestEvents] });
        expect(target.projected).toEqual(Array.from({ length: 26 }, (_, index) => String(index + 1)));
        expect(heartbeat).toHaveBeenCalledOnce();
        expect(heartbeatAt).toEqual([25]);
    });

    it("배치 유스케이스가 실패하면 이후 메시지를 해석하지 않고 실패를 전달한다", async () => {
        const target = harness("2");
        await target.consumer.start();

        await expect(
            target.batch()(batchPayload([ledgerRow(1), ledgerRow(2), ledgerRow(3)], async () => undefined)),
        ).rejects.toThrow("projection failed");

        expect(target.projected).toEqual(["1", "2"]);
    });
});
