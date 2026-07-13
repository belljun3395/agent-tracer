import { describe, expect, it } from "vitest";
import { SessionEntity, TaskEntity } from "@monitor/tracer-domain";
import { InMemorySessionReader } from "~tracer-api/domain/task/port/__fakes__/in-memory.session.reader.js";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { InMemoryTaskUserStateRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.user.state.repository.js";
import { GetTaskUseCase } from "./get.task.usecase.js";

function makeTask(id: string, userId: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = userId;
    task.title = "hello";
    task.slug = "hello";
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = "/repo";
    task.cliSource = null;
    task.parentTaskId = null;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = new Date("2026-01-01T00:00:00.000Z");
    task.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return task;
}

function makeSession(
    id: string,
    runtimeSessionId: string,
    startedAt: string,
): SessionEntity {
    const session = new SessionEntity();
    session.id = id;
    session.taskId = "t1";
    session.runtimeSource = "claude-plugin";
    session.runtimeSessionId = runtimeSessionId;
    session.status = "active";
    session.summary = null;
    session.startedAt = new Date(startedAt);
    session.endedAt = null;
    return session;
}

function makeUseCase(tasks: TaskEntity[], sessions: SessionEntity[]): GetTaskUseCase {
    const taskRepo = new InMemoryTaskRepository();
    taskRepo.seed(...tasks);
    const stateRepo = new InMemoryTaskUserStateRepository();
    const sessionRepo = new InMemorySessionReader();
    sessionRepo.seed(...sessions);
    return new GetTaskUseCase(taskRepo, stateRepo, sessionRepo);
}

describe("GetTaskUseCase", () => {
    it("최신 런타임 세션을 resumeTarget으로 함께 반환한다", async () => {
        const useCase = makeUseCase(
            [makeTask("t1", "u1")],
            [
                makeSession("monitor-session-old", "runtime-old", "2026-01-01T00:00:00.000Z"),
                makeSession("monitor-session-new", "runtime-new", "2026-01-01T01:00:00.000Z"),
            ],
        );

        const result = await useCase.execute("u1", "t1");

        expect(result?.resumeTarget).toEqual({
            taskId: "t1",
            runtimeSource: "claude-plugin",
            runtimeSessionId: "runtime-new",
            workspacePath: "/repo",
        });
        expect(result?.sessions.map((session) => session.id)).toEqual([
            "monitor-session-new",
            "monitor-session-old",
        ]);
    });

    it("런타임 세션 ID가 없으면 resumeTarget을 생략한다", async () => {
        const useCase = makeUseCase(
            [makeTask("t1", "u1")],
            [makeSession("monitor-session", "", "2026-01-01T00:00:00.000Z")],
        );

        const result = await useCase.execute("u1", "t1");

        expect(result).not.toHaveProperty("resumeTarget");
    });
});
