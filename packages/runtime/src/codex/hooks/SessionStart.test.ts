import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureRuntimeSession = vi.fn();
const postTaggedEvent = vi.fn();
const readStdinJson = vi.fn();
const writeLatestSessionState = vi.fn();
const ensureObserverRunning = vi.fn();
const toTrimmedString = vi.fn((value: unknown) => (typeof value === "string" ? value.trim() : ""));

vi.mock("~codex/lib/transport/transport.js", () => ({
    ensureRuntimeSession,
    postTaggedEvent,
    readStdinJson,
}));

vi.mock("~codex/util/session.state.js", () => ({
    writeLatestSessionState,
}));

vi.mock("~codex/util/observer.js", () => ({
    ensureObserverRunning,
}));

vi.mock("~codex/util/utils.js", () => ({
    toTrimmedString,
}));

describe("Codex SessionStart hook", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        ensureRuntimeSession.mockResolvedValue({
            taskId: "task_1",
            sessionId: "session_1",
        });
        postTaggedEvent.mockResolvedValue(undefined);
        writeLatestSessionState.mockResolvedValue("");
        ensureObserverRunning.mockResolvedValue("started");
    });

    it("records startup, persists the session hint, and starts the observer", async () => {
        readStdinJson.mockResolvedValue({
            session_id: "runtime_1",
            source: "startup",
            model: "gpt-5.4",
        });

        await import("./SessionStart.js");
        await vi.waitFor(() => {
            expect(postTaggedEvent).toHaveBeenCalledTimes(1);
        });

        expect(postTaggedEvent).toHaveBeenCalledWith(expect.objectContaining({
            kind: "context.saved",
            taskId: "task_1",
            sessionId: "session_1",
            title: "Session started",
        }));

        expect(writeLatestSessionState).toHaveBeenCalledWith({
            sessionId: "runtime_1",
            modelId: "gpt-5.4",
            source: "startup",
        });
        expect(ensureObserverRunning).toHaveBeenCalledWith("runtime_1");
    });

    it("ignores unsupported SessionStart reasons", async () => {
        readStdinJson.mockResolvedValue({
            session_id: "runtime_1",
            source: "clear",
        });

        await import("./SessionStart.js");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(postTaggedEvent).not.toHaveBeenCalled();
        expect(writeLatestSessionState).not.toHaveBeenCalled();
        expect(ensureObserverRunning).not.toHaveBeenCalled();
    });
});
