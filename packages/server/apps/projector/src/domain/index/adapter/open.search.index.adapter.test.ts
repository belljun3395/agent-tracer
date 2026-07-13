import { describe, expect, it, vi } from "vitest";
import type { Client } from "@opensearch-project/opensearch";
import type { SearchBulkOperation } from "~projector/domain/index/port/search.index.writer.port.js";
import { OpenSearchIndexAdapter } from "~projector/domain/index/adapter/open.search.index.adapter.js";

describe("OpenSearchIndexAdapter", () => {
    it("애플리케이션 벌크 명령을 OpenSearch 요청으로 변환한다", async () => {
        const bulk = vi.fn(async () => ({ body: { errors: false, items: [{ index: {} }, { update: {} }] } }));
        const adapter = new OpenSearchIndexAdapter({ bulk } as unknown as Client);
        const operations: SearchBulkOperation[] = [
            { action: "index", index: "events-v1", id: "e1", document: { title: "이벤트" } },
            { action: "update", index: "tasks-v1", id: "t1", document: { status: "running" }, upsert: true },
        ];

        const result = await adapter.writeBulk(operations);

        expect(bulk).toHaveBeenCalledWith({
            body: [
                { index: { _index: "events-v1", _id: "e1" } },
                { title: "이벤트" },
                { update: { _index: "tasks-v1", _id: "t1" } },
                { doc: { status: "running" }, doc_as_upsert: true },
            ],
            refresh: false,
        });
        expect(result).toEqual({ errors: false, itemCount: 2 });
    });

    it("신규 인덱스 생성 시 요청받은 경우에만 alias를 붙인다", async () => {
        const create = vi.fn(async (_request: { index: string; body: Record<string, unknown> }) => ({}));
        const client = {
            indices: {
                exists: vi.fn(async () => ({ body: false })),
                create,
            },
        } as unknown as Client;
        const adapter = new OpenSearchIndexAdapter(client);
        const definition = {
            alias: "events",
            index: "events-v2",
            settings: { number_of_shards: 1 },
            mappings: { properties: {} },
        };

        await adapter.ensureIndex(definition, true);
        await adapter.ensureIndex({ ...definition, index: "events-v3" }, false);

        expect(create.mock.calls[0]?.[0]).toMatchObject({
            index: "events-v2",
            body: { aliases: { events: {} } },
        });
        expect(create.mock.calls[1]?.[0]).toEqual({
            index: "events-v3",
            body: {
                settings: definition.settings,
                mappings: definition.mappings,
            },
        });
    });

    it("보존 기한 삭제를 날짜 범위 쿼리로 변환한다", async () => {
        const deleteByQuery = vi.fn(async () => ({ body: { deleted: 7 } }));
        const adapter = new OpenSearchIndexAdapter({ deleteByQuery } as unknown as Client);
        const cutoff = new Date("2026-07-01T00:00:00.000Z");

        const deleted = await adapter.deleteBefore("events", "occurredAt", cutoff);

        expect(deleteByQuery).toHaveBeenCalledWith({
            index: "events",
            body: { query: { range: { occurredAt: { lt: cutoff.toISOString() } } } },
            refresh: true,
        });
        expect(deleted).toBe(7);
    });
});
