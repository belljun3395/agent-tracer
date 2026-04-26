import { afterEach, describe, expect, it, vi } from "vitest";
import { StartTaskUseCase } from "../start.task.usecase.js";
import { createPorts, task } from "~application/sessions/test/runtime.session.usecase.test.fixture.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("StartTaskUseCase", () => {
    it("creates a new task, monitor session, and task.start event", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000201")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000202");
        const state = createPorts();

        const result = await new StartTaskUseCase(state.taskLifecycle).execute({
            taskId: "task-1",
            title: "First prompt",
            workspacePath: "/tmp/project/",
            runtimeSource: "codex",
            summary: "initial summary",
            metadata: { source: "test" },
        });

        expect(result).toMatchObject({
            task: expect.objectContaining({
                id: "task-1",
                title: "First prompt",
                slug: "first-prompt",
                status: "running",
                taskKind: "primary",
                workspacePath: "/tmp/project",
                runtimeSource: "codex",
            }),
            sessionId: "00000000-0000-4000-8000-000000000201",
            events: [{ id: "00000000-0000-4000-8000-000000000202", kind: "task.start" }],
        });
        expect(state.sessions.get("00000000-0000-4000-8000-000000000201")).toMatchObject({
            taskId: "task-1",
            status: "running",
            summary: "initial summary",
        });
        expect(state.events[0]).toMatchObject({
            id: "00000000-0000-4000-8000-000000000202",
            taskId: "task-1",
            sessionId: "00000000-0000-4000-8000-000000000201",
            kind: "task.start",
            title: "First prompt",
            body: "initial summary",
            metadata: {
                source: "test",
                taskKind: "primary",
                workspacePath: "/tmp/project",
                runtimeSource: "codex",
            },
        });
    });

    it("generates a task id and preserves background linkage fields", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000203")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000204")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000205");
        const state = createPorts();

        const result = await new StartTaskUseCase(state.taskLifecycle).execute({
            title: "Background worker",
            taskKind: "background",
            parentTaskId: "parent-task",
            parentSessionId: "parent-session",
            backgroundTaskId: "background-root",
        });

        expect(result.task).toMatchObject({
            id: "00000000-0000-4000-8000-000000000203",
            title: "Background worker",
            taskKind: "background",
            parentTaskId: "parent-task",
            parentSessionId: "parent-session",
            backgroundTaskId: "background-root",
        });
        expect(result.sessionId).toBe("00000000-0000-4000-8000-000000000204");
        expect(result.events).toEqual([
            { id: "00000000-0000-4000-8000-000000000205", kind: "task.start" },
        ]);
        expect(state.events[0]?.metadata).toMatchObject({
            taskKind: "background",
            parentTaskId: "parent-task",
            parentSessionId: "parent-session",
            backgroundTaskId: "background-root",
        });
    });

    it("restarts an existing task with a new session without recording another task.start event", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000206");
        const state = createPorts({
            tasks: [task({ id: "task-1", status: "completed", runtimeSource: "old-source" })],
        });

        const result = await new StartTaskUseCase(state.taskLifecycle).execute({
            taskId: "task-1",
            title: "Resume task",
            runtimeSource: "codex",
        });

        expect(result).toMatchObject({
            task: expect.objectContaining({
                id: "task-1",
                title: "Resume task",
                status: "running",
                runtimeSource: "codex",
            }),
            sessionId: "00000000-0000-4000-8000-000000000206",
            events: [],
        });
        expect(state.sessions.get("00000000-0000-4000-8000-000000000206")).toMatchObject({
            taskId: "task-1",
            status: "running",
        });
        expect(state.events).toHaveLength(0);
    });
});
