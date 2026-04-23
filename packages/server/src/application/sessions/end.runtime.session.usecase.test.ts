import { afterEach, describe, expect, it, vi } from "vitest";
import { EndRuntimeSessionUseCase } from "./end.runtime.session.usecase.js";
import { binding, createPorts, session, task } from "./runtime.session.usecase.test.fixture.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("EndRuntimeSessionUseCase", () => {
    it("falls back to the historical task association when completing without an active binding", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000004");
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: null })],
        });

        await new EndRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.events, state.ports.runtimeBindings, state.ports.notifier).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            completeTask: true,
            summary: "done",
        });

        expect(state.tasks.get("task-1")?.status).toBe("completed");
        expect(state.bindings.has("codex:runtime-1")).toBe(false);
        expect(state.events).toHaveLength(1);
    });

    it("clears the runtime binding when it points at an already-ended monitor session", async () => {
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1", status: "completed" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: "session-1" })],
        });

        await new EndRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.events, state.ports.runtimeBindings, state.ports.notifier).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            completeTask: true,
        });

        expect(state.mocks.sessionsUpdateStatus).not.toHaveBeenCalled();
        expect(state.mocks.runtimeBindingsClearSession).toHaveBeenCalledWith("codex", "runtime-1");
        expect(state.tasks.get("task-1")?.status).toBe("completed");
        expect(state.bindings.get("codex:runtime-1")?.monitorSessionId).toBeNull();
    });

    it("closes the active monitor session and clears the runtime binding", async () => {
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: "session-1" })],
        });

        await new EndRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.events, state.ports.runtimeBindings, state.ports.notifier).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            summary: "turn ended",
        });

        expect(state.sessions.get("session-1")).toMatchObject({
            status: "completed",
            summary: "turn ended",
        });
        expect(state.bindings.get("codex:runtime-1")?.monitorSessionId).toBeNull();
        expect(state.tasks.get("task-1")?.status).toBe("running");
    });

    it("completes a primary task when explicit completion is requested and lifecycle rules allow it", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000005");
        const state = createPorts({
            tasks: [task({ id: "task-1" })],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: "session-1" })],
        });

        await new EndRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.events, state.ports.runtimeBindings, state.ports.notifier).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            completeTask: true,
            completionReason: "explicit_exit",
        });

        expect(state.sessions.get("session-1")?.status).toBe("completed");
        expect(state.tasks.get("task-1")?.status).toBe("completed");
        expect(state.events).toHaveLength(1);
    });

    it("auto-completes a background task after its last monitor session ends", async () => {
        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000006");
        const state = createPorts({
            tasks: [task({ id: "bg-1", taskKind: "background" })],
            sessions: [session({ id: "session-1", taskId: "bg-1" })],
            bindings: [binding({ taskId: "bg-1", monitorSessionId: "session-1" })],
        });

        await new EndRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.events, state.ports.runtimeBindings, state.ports.notifier).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
        });

        expect(state.sessions.get("session-1")?.status).toBe("completed");
        expect(state.tasks.get("bg-1")?.status).toBe("completed");
    });

    it("moves a primary task to waiting when background descendants keep running", async () => {
        const state = createPorts({
            tasks: [
                task({ id: "task-1" }),
                task({ id: "bg-1", taskKind: "background", parentTaskId: "task-1" }),
            ],
            sessions: [session({ id: "session-1", taskId: "task-1" })],
            bindings: [binding({ taskId: "task-1", monitorSessionId: "session-1" })],
        });

        await new EndRuntimeSessionUseCase(state.ports.tasks, state.ports.sessions, state.ports.events, state.ports.runtimeBindings, state.ports.notifier).execute({
            runtimeSource: "codex",
            runtimeSessionId: "runtime-1",
            completionReason: "assistant_turn_complete",
        });

        expect(state.sessions.get("session-1")?.status).toBe("completed");
        expect(state.tasks.get("task-1")?.status).toBe("waiting");
        expect(state.tasks.get("bg-1")?.status).toBe("running");
    });
});
