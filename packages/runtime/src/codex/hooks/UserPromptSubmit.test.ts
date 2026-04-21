import { beforeEach, describe, expect, it, vi } from "vitest";

const readHookSessionContext = vi.fn();
const ensureRuntimeSession = vi.fn();
const postTaggedEvent = vi.fn();
const writeLatestSessionState = vi.fn();
const ensureObserverRunning = vi.fn();

vi.mock("~codex/lib/hook/hook.context.js", () => ({
    readHookSessionContext,
}));

vi.mock("~codex/lib/transport/transport.js", () => ({
    ensureRuntimeSession,
    postTaggedEvent,
}));

vi.mock("~codex/util/session.state.js", () => ({
    writeLatestSessionState,
}));

vi.mock("~codex/util/observer.js", () => ({
    ensureObserverRunning,
}));

describe("Codex UserPromptSubmit hook", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        ensureRuntimeSession.mockResolvedValue({
            taskId: "task_1",
            sessionId: "session_1",
            taskCreated: false,
        });
        postTaggedEvent.mockResolvedValue(undefined);
        writeLatestSessionState.mockResolvedValue("");
        ensureObserverRunning.mockResolvedValue("started");
    });

    it("records the prompt and ensures the observer for the active model", async () => {
        readHookSessionContext.mockResolvedValue({
            payload: { session_id: "runtime_1", prompt: "왜 gpt 모델은 없지?", model: "gpt-5.4" },
            sessionId: "runtime_1",
        });

        await import("./UserPromptSubmit.js");
        await vi.waitFor(() => {
            expect(postTaggedEvent).toHaveBeenCalledTimes(1);
        });

        expect(writeLatestSessionState).toHaveBeenCalledWith({
            sessionId: "runtime_1",
            modelId: "gpt-5.4",
            source: "user_prompt_submit",
        });
        expect(ensureObserverRunning).toHaveBeenCalledWith("runtime_1", undefined, "gpt-5.4");
    });
});
