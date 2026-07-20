import { describe, expect, it, vi } from "vitest";
import { KIND, type EventKind, type NotificationEnvelope } from "@monitor/kernel";
import type { ArrivalProjection } from "~projector/domain/project/application/arrival.projection.js";
import type { RunProjection } from "~projector/domain/project/application/run.projection.js";
import type { TimelineProjection } from "~projector/domain/project/application/timeline.projection.js";
import type { IClock } from "~projector/domain/project/port/clock.port.js";
import type { NotificationPublisherPort } from "~projector/domain/project/port/notification.publisher.port.js";
import type { LedgerProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { TracerDatabase } from "~projector/domain/project/port/tracer.database.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { ApplyLedgerBatchUseCase } from "./apply.ledger.batch.usecase.js";

function record(seq: number, kind: EventKind = KIND.userMessage): LedgerRecord {
    return {
        id: `event-${seq}`,
        seq: String(seq),
        userId: "user-1",
        taskId: "task-1",
        sessionId: null,
        kind,
        occurredAt: new Date("2026-07-10T00:00:00.000Z"),
        receivedAt: new Date("2026-07-10T00:00:01.000Z"),
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        parentSpanId: null,
        payload: {},
    };
}

interface Harness {
    readonly usecase: ApplyLedgerBatchUseCase;
    readonly run: { readonly project: ReturnType<typeof vi.fn> };
    readonly timeline: { readonly project: ReturnType<typeof vi.fn> };
    readonly ruleEvaluation: { readonly project: ReturnType<typeof vi.fn> };
    readonly recipe: { readonly projectInjected: ReturnType<typeof vi.fn> };
    readonly published: NotificationEnvelope[];
    readonly transactionEvents: string[];
}

function makeHarness(): Harness {
    const transactionEvents: string[] = [];
    const repositories = {} as LedgerProjectionRepositories;
    const database: Pick<TracerDatabase, "withTransaction"> = {
        withTransaction: async <T>(work: (repos: LedgerProjectionRepositories) => Promise<T>) => {
            transactionEvents.push("start");
            const result = await work(repositories);
            transactionEvents.push("commit");
            return result;
        },
    };
    const runNotification = { userId: "user-1", notification: { type: "run", payload: {} } } as unknown as NotificationEnvelope;
    const timelineNotification = { userId: "user-1", notification: { type: "timeline", payload: {} } } as unknown as NotificationEnvelope;
    const ruleNotification = { userId: "user-1", notification: { type: "rule", payload: {} } } as unknown as NotificationEnvelope;

    const run = { project: vi.fn(async () => [runNotification]) };
    const timeline = {
        project: vi.fn(async (_repos: unknown, item: LedgerRecord) => ({
            notifications: [timelineNotification],
            closedTurn: item.kind === KIND.userMessage ? { id: "turn-4", taskId: item.taskId } : null,
        })),
    };
    const ruleEvaluation = { project: vi.fn(async () => [ruleNotification]) };
    const recipe = { projectInjected: vi.fn(async () => undefined) };
    const arrival = {
        merge: vi.fn(),
        projectBatch: vi.fn(async () => []),
    };
    const published: NotificationEnvelope[] = [];
    const notifier: NotificationPublisherPort = {
        publish: async (envelope) => {
            published.push(envelope);
        },
    };

    const clock: IClock = { nowMs: () => 0, nowIso: () => "2026-07-10T00:00:00.000Z", now: () => new Date(0) };

    const usecase = new ApplyLedgerBatchUseCase(
        database as TracerDatabase,
        run as unknown as RunProjection,
        timeline as unknown as TimelineProjection,
        ruleEvaluation,
        recipe,
        arrival as unknown as ArrivalProjection,
        notifier,
        clock,
    );

    return { usecase, run, timeline, ruleEvaluation, recipe, published, transactionEvents };
}

describe("ApplyLedgerBatchUseCase", () => {
    it("이벤트 종류에 맞는 투영 단계만 부르고 트랜잭션 커밋 뒤 알림을 순서대로 발행한다", async () => {
        const h = makeHarness();
        const projected: string[] = [];

        await h.usecase.execute(
            [record(1, KIND.sessionStarted), record(2, KIND.recipeInjected), record(3, KIND.tokenUsage), record(4, KIND.userMessage), record(5, KIND.fileChanged)],
            async () => {
                projected.push("recorded");
            },
        );

        expect(h.run.project).toHaveBeenCalledOnce();
        expect(h.recipe.projectInjected).toHaveBeenCalledOnce();
        expect(h.timeline.project).toHaveBeenNthCalledWith(1, {}, expect.objectContaining({ seq: "3" }), false);
        expect(h.timeline.project).toHaveBeenNthCalledWith(2, {}, expect.objectContaining({ seq: "4" }), true);
        expect(h.timeline.project).toHaveBeenNthCalledWith(3, {}, expect.objectContaining({ seq: "5" }), true);
        expect(h.ruleEvaluation.project).toHaveBeenCalledOnce();
        expect(projected).toHaveLength(5);
        expect(h.transactionEvents).toEqual(["start", "commit"]);
        expect(h.published.map((e) => e.notification.type)).toEqual(["run", "timeline", "rule", "timeline"]);
    });

    it("알 수 없는 이벤트 종류는 조용히 건너뛰고 알림을 만들지 않는다", async () => {
        const h = makeHarness();

        await h.usecase.execute([record(1, "future.kind" as EventKind)], async () => undefined);

        expect(h.published).toEqual([]);
    });

    it("레코드 투영이 실패하면 배치 병합과 알림 발행을 하지 않는다", async () => {
        const h = makeHarness();
        h.timeline.project.mockRejectedValueOnce(new Error("projection failed"));

        await expect(
            h.usecase.execute([record(1, KIND.userMessage)], async () => undefined),
        ).rejects.toThrow("projection failed");

        expect(h.published).toEqual([]);
    });
});
