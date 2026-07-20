import { describe, expect, it } from "vitest";
import { KIND, spanIdOf, type IngestEvent } from "@monitor/kernel";
import type {
    AllRejectedIngestLog,
    AppendedIngestLog,
    AppendFailedIngestLog,
    IngestEventLog,
    RejectedIngestLog,
} from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import type {
    LedgerEventRecord,
    LedgerEventStore,
} from "~runtime-api/domain/ingest/port/ledger.event.store.port.js";
import { AppendEventsUseCase } from "./append.events.usecase.js";

function makeHarness(overrides: { readonly appendAll?: LedgerEventStore["appendAll"] } = {}): {
    readonly useCase: AppendEventsUseCase;
    readonly appended: LedgerEventRecord[][];
    readonly rejectedLogs: RejectedIngestLog[];
    readonly appendedLogs: AppendedIngestLog[];
    readonly appendFailedLogs: AppendFailedIngestLog[];
    readonly allRejectedLogs: AllRejectedIngestLog[];
} {
    const appended: LedgerEventRecord[][] = [];
    const ledger: LedgerEventStore = {
        appendAll: overrides.appendAll ?? ((rows: readonly LedgerEventRecord[]) => {
            appended.push([...rows]);
            return Promise.resolve();
        }),
    };
    const rejectedLogs: RejectedIngestLog[] = [];
    const appendedLogs: AppendedIngestLog[] = [];
    const appendFailedLogs: AppendFailedIngestLog[] = [];
    const allRejectedLogs: AllRejectedIngestLog[] = [];
    const ingestLog: IngestEventLog = {
        rejected: (entry) => rejectedLogs.push(entry),
        appended: (entry) => appendedLogs.push(entry),
        appendFailed: (entry) => appendFailedLogs.push(entry),
        allRejected: (entry) => allRejectedLogs.push(entry),
        contractVersionRejected: () => undefined,
        batchRejected: () => undefined,
        rateLimited: () => undefined,
    };
    return {
        useCase: new AppendEventsUseCase(ledger, ingestLog),
        appended,
        rejectedLogs,
        appendedLogs,
        appendFailedLogs,
        allRejectedLogs,
    };
}

function makeIngestEvent(overrides: Partial<IngestEvent> = {}): IngestEvent {
    return {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        kind: KIND.actionLogged,
        taskId: "task-1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        payload: {},
        ...overrides,
    };
}

describe("AppendEventsUseCase", () => {
    it("IngestEvent를 영속성 기술 없는 원장 레코드로 변환한다", async () => {
        const { useCase, appended, appendedLogs } = makeHarness();

        await useCase.execute("user-1", [makeIngestEvent({ taskId: "task-1" })]);

        expect(appended).toHaveLength(1);
        expect(appended[0]![0]).toMatchObject({
            id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
            userId: "user-1",
            taskId: "task-1",
        });
        expect(appendedLogs).toEqual([{
            userId: "user-1",
            count: 1,
            taskIds: ["task-1"],
            eventIds: ["01ARZ3NDEKTSV4RRFFQ69G5FAV"],
        }]);
    });

    it("sessionId가 없으면 null로 채운다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", [makeIngestEvent({})]);

        expect(appended[0]![0]!.sessionId).toBeNull();
    });

    it("occurredAt 문자열을 Date로 변환한다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", [makeIngestEvent({ occurredAt: "2026-01-01T00:00:00.000Z" })]);

        expect(appended[0]![0]!.occurredAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    });

    it("수용된 이벤트가 없으면 저장소를 호출하지 않는다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", []);

        expect(appended).toEqual([]);
    });

    it("거부된 레코드가 있어도 수용된 이벤트는 저장한다", async () => {
        const { useCase, appended, rejectedLogs } = makeHarness();

        await useCase.execute(
            "user-1",
            [makeIngestEvent({ id: "ev-good" })],
            [{ id: "ev-bad", reason: "lone surrogate" }],
        );

        expect(appended[0]!.map((row) => row.id)).toEqual(["ev-good"]);
        expect(rejectedLogs).toEqual([{ userId: "user-1", eventId: "ev-bad", reason: "lone surrogate" }]);
    });

    it("같은 세션의 이벤트는 같은 trace에 서로 다른 span으로 담는다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", [
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId: "01HZ0000000000000000000001" }),
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAW", sessionId: "01HZ0000000000000000000001" }),
        ]);

        const [first, second] = appended[0]!;
        expect(first!.traceId).toBe(second!.traceId);
        expect(first!.spanId).not.toBe(second!.spanId);
        expect(first!.parentSpanId).toBeNull();
    });

    it("세션이 없는 이벤트는 태스크를 trace 경계로 삼는다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", [
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", taskId: "01HZ0000000000000000000009" }),
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAW", taskId: "01HZ0000000000000000000009" }),
        ]);

        const [first, second] = appended[0]!;
        expect(first!.traceId).toBe(second!.traceId);
    });

    it("턴을 트레이스 경계로 삼고 턴 span 자신은 루트로 남긴다", async () => {
        const { useCase, appended } = makeHarness();
        const turnId = "01HZ0000000000000000000TURN";

        await useCase.execute("user-1", [
            makeIngestEvent({ id: turnId, turnId, sessionId: "01HZ0000000000000000000001" }),
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAW", turnId, sessionId: "01HZ0000000000000000000001" }),
        ]);

        const [turnSpan, child] = appended[0]!;
        expect(child!.traceId).toBe(turnSpan!.traceId);
        expect(turnSpan!.parentSpanId).toBeNull();
        expect(child!.parentSpanId).toBe(turnSpan!.spanId);
    });

    it("턴 밖 이벤트는 세션 트레이스로 떨어뜨린다", async () => {
        const { useCase, appended } = makeHarness();
        const sessionId = "01HZ0000000000000000000001";

        await useCase.execute("user-1", [
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId, turnId: "01HZ0000000000000000000TURN" }),
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAW", sessionId }),
        ]);

        const [inTurn, outOfTurn] = appended[0]!;
        expect(inTurn!.traceId).not.toBe(outOfTurn!.traceId);
        expect(outOfTurn!.parentSpanId).toBeNull();
    });

    it("명시된 인과 부모를 턴보다 우선한다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", [
            makeIngestEvent({
                id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
                turnId: "01HZ0000000000000000000TURN",
                parentId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
            }),
        ]);

        const [row] = appended[0]!;
        expect(row!.parentSpanId).toBe(spanIdOf("01ARZ3NDEKTSV4RRFFQ69G5FAV"));
    });

    it("모든 레코드가 거부돼 수용된 이벤트가 없으면 요약 한 줄을 남긴다", async () => {
        const { useCase, allRejectedLogs } = makeHarness();

        await useCase.execute("user-1", [], [{ id: "ev-bad", reason: "lone surrogate" }]);

        expect(allRejectedLogs).toEqual([{ userId: "user-1", count: 1 }]);
    });

    it("거부된 레코드가 없으면 배치가 비어도 요약을 남기지 않는다", async () => {
        const { useCase, allRejectedLogs } = makeHarness();

        await useCase.execute("user-1", []);

        expect(allRejectedLogs).toEqual([]);
    });

    it("원장 저장이 실패하면 배치 크기와 사유를 남기고 예외를 다시 던진다", async () => {
        const { useCase, appendFailedLogs, appendedLogs } = makeHarness({
            appendAll: () => Promise.reject(new Error("connection reset")),
        });

        await expect(
            useCase.execute("user-1", [makeIngestEvent({ id: "ev-1" })]),
        ).rejects.toThrow("connection reset");
        expect(appendFailedLogs).toEqual([{ userId: "user-1", count: 1, error: "connection reset" }]);
        expect(appendedLogs).toEqual([]);
    });

    it("인과 부모가 있으면 부모 span을 가리킨다", async () => {
        const { useCase, appended } = makeHarness();

        await useCase.execute("user-1", [
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }),
            makeIngestEvent({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAW", parentId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }),
        ]);

        const [parent, child] = appended[0]!;
        expect(child!.parentSpanId).toBe(parent!.spanId);
    });
});
