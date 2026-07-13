import { describe, expect, it, vi } from "vitest";
import { KIND } from "@monitor/kernel";
import {
    SessionEntity,
    SessionRepository,
    TaskEntity,
    TaskRepository,
} from "@monitor/tracer-domain";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import type { RunEventProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { RunSessionProjection } from "~projector/domain/project/application/run.session.projection.js";
import { RunTaskProjection } from "~projector/domain/project/application/run.task.projection.js";
import type { RecipeProjection } from "./recipe.projection.js";
import { RunProjection } from "./run.projection.js";

function makeRepositories() {
    const tasksFake = createInMemoryRepository<TaskEntity>();
    const sessionsFake = createInMemoryRepository<SessionEntity>();
    const repositories = {
        tasks: new TaskRepository(asRepository(tasksFake)),
        sessions: new SessionRepository(asRepository(sessionsFake)),
    } as unknown as RunEventProjectionRepositories;
    return { repositories, sessionsFake, tasksFake };
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

function makeSession(overrides: Partial<SessionEntity> = {}): SessionEntity {
    const session = new SessionEntity();
    session.id = "session-1";
    session.taskId = "task-1";
    session.runtimeSource = "claude-code";
    session.runtimeSessionId = "runtime-session-1";
    session.status = "active";
    session.summary = null;
    session.startedAt = new Date("2026-01-01T00:00:00.000Z");
    session.endedAt = null;
    return Object.assign(session, overrides);
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

function makeProjection() {
    const resolveForTask = vi.fn().mockResolvedValue(undefined);
    const recipes = { resolveForTask } as unknown as RecipeProjection;
    const tasks = new RunTaskProjection();
    const sessions = new RunSessionProjection(tasks);
    return { projection: new RunProjection(tasks, sessions, recipes), resolveForTask };
}

describe("RunProjection", () => {
    it("세션 시작 시 태스크와 세션을 만들고 두 시작 알림을 순서대로 만든다", async () => {
        const { repositories, sessionsFake, tasksFake } = makeRepositories();
        const { projection } = makeProjection();

        const notifications = await projection.project(
            repositories,
            makeRecord({
                kind: KIND.sessionStarted,
                sessionId: "session-1",
                payload: {
                    title: "새 태스크",
                    runtimeSource: "claude-code",
                    runtimeSessionId: "runtime-session-1",
                    workspacePath: "/workspace",
                },
            }),
        );

        expect(tasksFake.all()[0]).toMatchObject({
            id: "task-1",
            title: "새 태스크",
            slug: "task",
            workspacePath: "/workspace",
            lastSessionStartedAt: new Date("2026-01-01T00:01:00.000Z"),
        });
        expect(sessionsFake.all()[0]).toMatchObject({
            id: "session-1",
            taskId: "task-1",
            runtimeSource: "claude-code",
            runtimeSessionId: "runtime-session-1",
            status: "active",
        });
        expect(notifications.map(({ notification }) => notification.type)).toEqual([
            "session.started",
            "task.started",
        ]);
    });

    it("기존 태스크에서 세션을 시작하면 태스크 시작 알림을 중복하지 않는다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask());
        const { projection } = makeProjection();

        const notifications = await projection.project(
            repositories,
            makeRecord({ kind: KIND.sessionStarted, sessionId: "session-1" }),
        );

        expect(notifications.map(({ notification }) => notification.type)).toEqual(["session.started"]);
    });

    it("세션 종료 시 기존 세션의 요약과 종료 시각을 반영한다", async () => {
        const { repositories, sessionsFake } = makeRepositories();
        sessionsFake.seed(makeSession());
        const { projection } = makeProjection();

        const notifications = await projection.project(
            repositories,
            makeRecord({ kind: KIND.sessionEnded, sessionId: "session-1", payload: { summary: "완료" } }),
        );

        expect(sessionsFake.all()[0]).toMatchObject({
            status: "ended",
            summary: "완료",
            endedAt: new Date("2026-01-01T00:01:00.000Z"),
        });
        expect(notifications[0]).toMatchObject({
            userId: "u1",
            notification: { type: "session.ended", payload: { taskId: "task-1", sessionId: "session-1" } },
        });
    });

    it("태스크 시작 이벤트가 태스크를 만들고 시작 알림을 만든다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        const { projection } = makeProjection();

        const notifications = await projection.project(
            repositories,
            makeRecord({ kind: KIND.taskStart, payload: { title: "시작 태스크" } }),
        );

        expect(tasksFake.all()[0]).toMatchObject({ title: "시작 태스크", status: "running" });
        expect(notifications[0]?.notification.type).toBe("task.started");
    });

    it("태스크 연결 시 기존 태스크의 연결 메타데이터를 갱신한다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        tasksFake.seed(makeTask());
        const { projection } = makeProjection();

        const notifications = await projection.project(
            repositories,
            makeRecord({
                kind: KIND.taskLinked,
                payload: {
                    title: "연결 태스크",
                    parentTaskId: "parent-task",
                    parentSessionId: "parent-session",
                    backgroundTaskId: "background-task",
                },
            }),
        );

        expect(tasksFake.all()[0]).toMatchObject({
            title: "연결 태스크",
            parentTaskId: "parent-task",
            parentSessionId: "parent-session",
            backgroundOfTaskId: "background-task",
        });
        expect(notifications[0]?.notification.type).toBe("task.updated");
    });

    it("태스크 종결 상태를 투영하고 레시피 적용 상태를 함께 해소한다", async () => {
        const { repositories, tasksFake } = makeRepositories();
        const { projection, resolveForTask } = makeProjection();

        const completed = await projection.project(
            repositories,
            makeRecord({ kind: KIND.taskComplete, seq: "10" }),
        );
        const errored = await projection.project(
            repositories,
            makeRecord({ kind: KIND.taskError, seq: "11", occurredAt: new Date("2026-01-01T00:02:00.000Z") }),
        );

        expect(tasksFake.all()[0]).toMatchObject({ status: "errored", lastAppliedSeq: "11" });
        expect(completed[0]?.notification.type).toBe("task.completed");
        expect(errored[0]?.notification.type).toBe("task.updated");
        expect(resolveForTask).toHaveBeenNthCalledWith(
            1,
            repositories,
            "task-1",
            "completed",
            new Date("2026-01-01T00:01:00.000Z"),
        );
        expect(resolveForTask).toHaveBeenNthCalledWith(
            2,
            repositories,
            "task-1",
            "errored",
            new Date("2026-01-01T00:02:00.000Z"),
        );
    });
});
