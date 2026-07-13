import { describe, expect, it, vi } from "vitest";
import { KIND } from "@monitor/kernel";
import { SessionRepository, TaskEntity, TaskRepository } from "@monitor/tracer-domain";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import type { RunProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { ArrivalProjection, type ArrivalCoalesced } from "./arrival.projection.js";

function makeRepositories() {
    const tasksFake = createInMemoryRepository<TaskEntity>();
    const repositories = {
        tasks: new TaskRepository(asRepository(tasksFake)),
        sessions: new SessionRepository(asRepository(createInMemoryRepository())),
    } as unknown as RunProjectionRepositories;
    return { repositories, tasksFake };
}

function makeTask(overrides: Partial<TaskEntity> = {}): TaskEntity {
    const task = new TaskEntity();
    task.id = "task-1";
    task.userId = "u1";
    task.title = "Task";
    task.slug = "task";
    task.workspacePath = null;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.cliSource = null;
    task.parentTaskId = null;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = new Date("2026-01-01T00:00:00.000Z");
    task.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return Object.assign(task, overrides);
}

function makeRecord(overrides: Partial<LedgerRecord> = {}): LedgerRecord {
    return {
        id: "event-1",
        seq: "1",
        userId: "u1",
        taskId: "task-1",
        sessionId: null,
        kind: KIND.sessionEnded,
        occurredAt: new Date("2026-01-01T00:01:00.000Z"),
        receivedAt: new Date("2026-01-01T00:01:00.000Z"),
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        parentSpanId: null,
        payload: {},
        ...overrides,
    };
}

describe("ArrivalProjection.projectRecord", () => {
    it("assistant turn 종료 이벤트가 도착하면 task를 waiting으로 전이한다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({ status: "running" }));
        const projection = new ArrivalProjection();

        const changedTask = await projection.projectRecord(
            repositories,
            makeRecord({ payload: { completeTask: false, completionReason: "assistant_turn_complete" } }),
        );

        expect(tasksFake.all()[0]?.status).toBe("waiting");
        expect(changedTask?.id).toBe("task-1");
    });

    it("유저 메시지가 도착하면 waiting task를 running으로 되돌린다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({ status: "waiting" }));
        const projection = new ArrivalProjection();

        const changedTask = await projection.projectRecord(
            repositories,
            makeRecord({ kind: KIND.userMessage, occurredAt: new Date("2026-01-01T00:02:00.000Z") }),
        );

        expect(tasksFake.all()[0]?.status).toBe("running");
        expect(changedTask?.id).toBe("task-1");
    });

    it("explicit_exit 세션 종료는 task를 completed로 전이한다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({ status: "running" }));
        const projection = new ArrivalProjection();

        await projection.projectRecord(
            repositories,
            makeRecord({ payload: { completeTask: false, completionReason: "explicit_exit" } }),
        );

        expect(tasksFake.all()[0]?.status).toBe("completed");
    });

    it("같은 상태를 재적용하면 변경 태스크를 반환하지 않는다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({ status: "waiting" }));
        const projection = new ArrivalProjection();

        const changedTask = await projection.projectRecord(
            repositories,
            makeRecord({ payload: { completeTask: false, completionReason: "assistant_turn_complete" } }),
        );

        expect(tasksFake.all()[0]?.status).toBe("waiting");
        expect(changedTask).toBeNull();
    });

    it("이미 반영한 시퀀스보다 뒤진 이벤트는 상태를 되돌리지 않는다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({
            status: "waiting",
            updatedAt: new Date("2026-01-01T00:05:00.000Z"),
            lastAppliedSeq: "10",
        }));
        const projection = new ArrivalProjection();

        const changedTask = await projection.projectRecord(
            repositories,
            makeRecord({ kind: KIND.userMessage, seq: "9" }),
        );

        expect(tasksFake.all()[0]?.status).toBe("waiting");
        expect(changedTask).toBeNull();
    });

    it("클라이언트 시각이 과거여도 시퀀스가 나중이면 상태를 반영한다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({
            status: "waiting",
            updatedAt: new Date("2026-01-01T00:05:00.000Z"),
            lastAppliedSeq: "10",
        }));
        const projection = new ArrivalProjection();

        const changedTask = await projection.projectRecord(
            repositories,
            makeRecord({
                kind: KIND.userMessage,
                seq: "11",
                occurredAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
        );

        expect(tasksFake.all()[0]?.status).toBe("running");
        expect(changedTask?.id).toBe("task-1");
    });

    it("대응하는 task가 없으면 건너뛴다", async () => {
        const { repositories } = makeRepositories();
        const projection = new ArrivalProjection();

        const changedTask = await projection.projectRecord(repositories, makeRecord({ taskId: "missing" }));

        expect(changedTask).toBeNull();
    });
});

describe("ArrivalProjection.projectBatch", () => {
    it("같은 task로 모인 배치 내 여러 이벤트를 병합해 upsert를 한 번만 호출한다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({ status: "running", updatedAt: new Date("2026-01-01T00:00:00.000Z") }));
        const upsertSpy = vi.spyOn(tasksFake, "upsert");
        const projection = new ArrivalProjection();
        const arrivals = new Map<string, ArrivalCoalesced>();
        projection.merge(
            arrivals,
            makeRecord({ kind: KIND.executeTool, occurredAt: new Date("2026-01-01T00:15:00.000Z") }),
        );
        projection.merge(
            arrivals,
            makeRecord({
                payload: { completeTask: false, completionReason: "assistant_turn_complete" },
                occurredAt: new Date("2026-01-01T00:10:00.000Z"),
            }),
        );
        projection.merge(
            arrivals,
            makeRecord({ kind: KIND.userMessage, occurredAt: new Date("2026-01-01T00:05:00.000Z") }),
        );

        const changedTasks = await projection.projectBatch(repositories, arrivals);

        expect(upsertSpy).toHaveBeenCalledTimes(1);
        expect(tasksFake.all()[0]?.status).toBe("waiting");
        expect(tasksFake.all()[0]?.lastEventAt).toEqual(new Date("2026-01-01T00:15:00.000Z"));
        expect(changedTasks).toHaveLength(1);
    });

    it("병합 순서가 바뀌어도 시퀀스 기준 최종 상태는 동일하다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask({ status: "running", updatedAt: new Date("2026-01-01T00:00:00.000Z") }));
        const projection = new ArrivalProjection();
        const records = [
            makeRecord({
                kind: KIND.userMessage,
                seq: "1",
                occurredAt: new Date("2026-01-01T00:10:00.000Z"),
            }),
            makeRecord({
                seq: "2",
                payload: { completeTask: false, completionReason: "assistant_turn_complete" },
                occurredAt: new Date("2026-01-01T00:05:00.000Z"),
            }),
        ];
        const forward = new Map<string, ArrivalCoalesced>();
        for (const record of records) projection.merge(forward, record);
        const reversed = new Map<string, ArrivalCoalesced>();
        for (const record of [...records].reverse()) projection.merge(reversed, record);

        expect(forward.get("task-1")).toEqual(reversed.get("task-1"));

        await projection.projectBatch(repositories, forward);
        expect(tasksFake.all()[0]?.status).toBe("waiting");
    });

    it("대응하는 task가 없으면 건너뛴다", async () => {
        const { repositories } = makeRepositories();
        const projection = new ArrivalProjection();
        const arrivals = new Map<string, ArrivalCoalesced>();
        projection.merge(arrivals, makeRecord({ taskId: "missing" }));

        const changedTasks = await projection.projectBatch(repositories, arrivals);

        expect(changedTasks).toHaveLength(0);
    });
});
