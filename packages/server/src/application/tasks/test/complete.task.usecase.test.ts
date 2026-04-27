import { afterEach, describe, expect, it, vi } from "vitest";
import { CompleteTaskUseCase } from "../complete.task.usecase.js";
import { createPorts, session, task } from "./runtime.session.test.fixture.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("CompleteTaskUseCase", () => {
    it("completes a running task, closes its active session, and records a completion event", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000101");
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
        });

        const result = await new CompleteTaskUseCase(state.taskLifecycle).execute({
            taskId: "task-1",
            summary: "done",
            metadata: { source: "test" },
        });

        expect(result.sessionId).toBe("session-1");
        expect(result.events).toEqual([
            { id: "00000000-0000-4000-8000-000000000101", kind: "task.complete" },
        ]);
        expect(state.tasks.get("task-1")).toMatchObject({ status: "completed" });
        expect(state.sessions.get("session-1")).toMatchObject({
            status: "completed",
            summary: "done",
        });
        expect(state.events[0]).toMatchObject({
            id: "00000000-0000-4000-8000-000000000101",
            taskId: "task-1",
            sessionId: "session-1",
            kind: "task.complete",
            title: "Task completed",
            body: "done",
            metadata: { source: "test" },
        });
    });

    it("closes an active session without duplicating events when the task is already completed", async () => {
        const state = createPorts({
            tasks: [task({ id: "task-1", status: "completed" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
        });

        const result = await new CompleteTaskUseCase(state.taskLifecycle).execute({
            taskId: "task-1",
            summary: "already done",
        });

        expect(result).toMatchObject({
            task: expect.objectContaining({ id: "task-1", status: "completed" }),
            sessionId: "session-1",
            events: [],
        });
        expect(state.sessions.get("session-1")).toMatchObject({
            status: "completed",
            summary: "already done",
        });
        expect(state.events).toHaveLength(0);
    });

    it("throws when the task does not exist", async () => {
        const state = createPorts();

        await expect(new CompleteTaskUseCase(state.taskLifecycle).execute({ taskId: "missing" }))
            .rejects.toThrow("Task not found: missing");
    });
});
