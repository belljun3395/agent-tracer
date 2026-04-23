import { afterEach, describe, expect, it, vi } from "vitest";
import { EnsureRuntimeSessionUseCase } from "./ensure.runtime.session.usecase.js";
import { binding, createPorts, session, task } from "./runtime.session.usecase.test.fixture.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("EnsureRuntimeSessionUseCase", () => {
    it("reuses an active binding without creating another monitor session", async () => {
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: "session-1" })],
        });

        const result = await new EnsureRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.runtimeBindings, state.ports.notifier, state.taskLifecycle).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            title: "ignored",
        });

        expect(result).toEqual({
            taskId: "task-1",
            sessionId: "session-1",
            taskCreated: false,
            sessionCreated: false,
        });
        expect(state.mocks.sessionsCreate).not.toHaveBeenCalled();
        expect(state.mocks.runtimeBindingsUpsert).not.toHaveBeenCalled();
    });

    it("does not reuse a binding that points at a closed monitor session", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000007");
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1", status: "completed" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: "session-1" })],
        });

        const result = await new EnsureRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.runtimeBindings, state.ports.notifier, state.taskLifecycle).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            title: "Resume",
        });

        expect(result).toEqual({
            taskId: "task-1",
            sessionId: "00000000-0000-4000-8000-000000000007",
            taskCreated: false,
            sessionCreated: true,
        });
        expect(state.mocks.runtimeBindingsClearSession).toHaveBeenCalledWith("codex", "runtime-1");
        expect(state.bindings.get("codex:runtime-1")?.monitorSessionId).toBe("00000000-0000-4000-8000-000000000007");
    });

    it("resolves the latest historical session when resume is false", async () => {
        const state = createPorts({
            tasks: [task({ id: "task-1", status: "completed" })],
            sessions: [
                session({ id: "old-session", taskId: "task-1", startedAt: "2026-01-01T00:00:00.000Z" }),
                session({ id: "latest-session", taskId: "task-1", startedAt: "2026-01-02T00:00:00.000Z" }),
            ],
            bindings: [binding({ taskId: "task-1", monitorSessionId: null })],
        });

        const result = await new EnsureRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.runtimeBindings, state.ports.notifier, state.taskLifecycle).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            title: "ignored",
            resume: false,
        });

        expect(result).toEqual({
            taskId: "task-1",
            sessionId: "latest-session",
            taskCreated: false,
            sessionCreated: false,
        });
        expect(state.mocks.sessionsCreate).not.toHaveBeenCalled();
        expect(state.tasks.get("task-1")?.status).toBe("completed");
    });

    it("resumes a historical task with a fresh random monitor session id", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
        const state = createPorts({
            tasks: [task({ id: "task-1", status: "completed", runtimeSource: "old-source" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: null })],
        });

        const result = await new EnsureRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.runtimeBindings, state.ports.notifier, state.taskLifecycle).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            title: "Resume",
        });

        expect(result).toEqual({
            taskId: "task-1",
            sessionId: "00000000-0000-4000-8000-000000000001",
            taskCreated: false,
            sessionCreated: true,
        });
        expect(state.sessions.get("00000000-0000-4000-8000-000000000001")).toMatchObject({
            taskId: "task-1",
            status: "running",
        });
        expect(state.tasks.get("task-1")).toMatchObject({
            status: "running",
            runtimeSource: "codex",
        });
        expect(state.bindings.get("codex:runtime-1")?.monitorSessionId).toBe("00000000-0000-4000-8000-000000000001");
    });

    it("creates the first task, monitor session, and runtime binding for a new runtime session", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000002")
            .mockReturnValueOnce("00000000-0000-4000-8000-000000000003");
        const state = createPorts();

        const result = await new EnsureRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.runtimeBindings, state.ports.notifier, state.taskLifecycle).execute({
            taskId: "task-1",
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            title: "First prompt",
            workspacePath: "/tmp/project",
        });

        expect(result).toEqual({
            taskId: "task-1",
            sessionId: "00000000-0000-4000-8000-000000000002",
            taskCreated: true,
            sessionCreated: true,
        });
        expect(state.tasks.get("task-1")).toMatchObject({
            title: "First prompt",
            status: "running",
            runtimeSource: "codex",
            workspacePath: "/tmp/project",
        });
        expect(state.sessions.get("00000000-0000-4000-8000-000000000002")).toMatchObject({
            taskId: "task-1",
            status: "running",
        });
        expect(state.bindings.get("codex:runtime-1")?.monitorSessionId).toBe("00000000-0000-4000-8000-000000000002");
        expect(state.events).toHaveLength(1);
    });
});
