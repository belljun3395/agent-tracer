import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorTaskUseCase } from "./error.task.usecase.js";
import { createPorts, session, task } from "../sessions/runtime.session.usecase.test.fixture.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("ErrorTaskUseCase", () => {
    it("marks a running task as errored, closes its active session, and records an error event", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000201");
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
        });

        const result = await new ErrorTaskUseCase(state.taskLifecycle).execute({
            taskId: "task-1",
            errorMessage: "build failed",
            summary: "failed during build",
            metadata: { source: "test" },
        });

        expect(result.sessionId).toBe("session-1");
        expect(result.events).toEqual([
            { id: "00000000-0000-4000-8000-000000000201", kind: "task.error" },
        ]);
        expect(state.tasks.get("task-1")).toMatchObject({ status: "errored" });
        expect(state.sessions.get("session-1")).toMatchObject({
            status: "errored",
            summary: "failed during build",
        });
        expect(state.events[0]).toMatchObject({
            id: "00000000-0000-4000-8000-000000000201",
            taskId: "task-1",
            sessionId: "session-1",
            kind: "task.error",
            title: "Task errored",
            body: "build failed",
            metadata: { source: "test" },
        });
    });

    it("closes an active session without duplicating events when the task is already errored", async () => {
        const state = createPorts({
            tasks: [task({ id: "task-1", status: "errored" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
        });

        const result = await new ErrorTaskUseCase(state.taskLifecycle).execute({
            taskId: "task-1",
            errorMessage: "already failed",
            summary: "already errored",
        });

        expect(result).toMatchObject({
            task: expect.objectContaining({ id: "task-1", status: "errored" }),
            sessionId: "session-1",
            events: [],
        });
        expect(state.sessions.get("session-1")).toMatchObject({
            status: "errored",
            summary: "already errored",
        });
        expect(state.events).toHaveLength(0);
    });

    it("throws when the task does not exist", async () => {
        const state = createPorts();

        await expect(new ErrorTaskUseCase(state.taskLifecycle).execute({
            taskId: "missing",
            errorMessage: "missing task",
        })).rejects.toThrow("Task not found: missing");
    });
});
