import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { IndexSearchUseCase } from "~projector/domain/index/application/index.search.usecase.js";
import { EVENTS_INDEX, TASKS_INDEX } from "~projector/domain/index/model/search.index.definitions.js";
import { InMemorySearchIndex } from "~projector/domain/index/port/__fakes__/in-memory.search.index.js";
import type { SearchBulkOperation } from "~projector/domain/index/port/search.index.writer.port.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeRecord(overrides: Partial<LedgerRecord> = {}): LedgerRecord {
    return {
        id: "ev-1",
        seq: "7",
        userId: "u1",
        taskId: "t1",
        sessionId: null,
        kind: KIND.executeTool,
        occurredAt: NOW,
        receivedAt: NOW,
        traceId: "trace",
        spanId: "span",
        parentSpanId: null,
        payload: {},
        ...overrides,
    };
}

function makeUseCase(): { useCase: IndexSearchUseCase; bulks: readonly SearchBulkOperation[][] } {
    const searchIndex = new InMemorySearchIndex();
    return { useCase: new IndexSearchUseCase(searchIndex), bulks: searchIndex.bulks };
}

describe("IndexSearchUseCase", () => {
    it("타임라인 이벤트는 이벤트 색인에 넣는다", async () => {
        const { useCase, bulks } = makeUseCase();

        await useCase.execute([makeRecord()]);

        expect(bulks[0]?.[0]).toMatchObject({
            action: "index",
            index: EVENTS_INDEX,
            id: "ev-1",
            document: { userId: "u1", taskId: "t1", kind: KIND.executeTool, seq: 7 },
        });
    });

    it("실행 이벤트는 태스크 문서를 upsert한다", async () => {
        const { useCase, bulks } = makeUseCase();

        await useCase.execute([makeRecord({ kind: KIND.taskComplete })]);

        expect(bulks[0]?.[0]).toMatchObject({
            action: "update",
            index: TASKS_INDEX,
            id: "t1",
            upsert: true,
        });
    });

    it("색인 대상이 없으면 벌크를 부르지 않는다", async () => {
        const { useCase, bulks } = makeUseCase();

        await useCase.execute([]);

        expect(bulks).toEqual([]);
    });
});
