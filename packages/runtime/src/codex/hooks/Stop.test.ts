import { beforeEach, describe, expect, it, vi } from "vitest";

const readHookSessionContext = vi.fn();
const ensureRuntimeSession = vi.fn();
const postTaggedEvent = vi.fn();
const postJson = vi.fn();
const writeLatestSessionState = vi.fn();
const createMessageId = vi.fn(() => "assistant_msg_1");
const ellipsize = vi.fn((value: string) => value);
const toTrimmedString = vi.fn((value: unknown) => (typeof value === "string" ? value.trim() : ""));

vi.mock("~codex/lib/hook/hook.context.js", () => ({
    readHookSessionContext,
}));

vi.mock("~codex/lib/transport/transport.js", () => ({
    ensureRuntimeSession,
    postTaggedEvent,
    postJson,
}));

vi.mock("~codex/util/utils.js", () => ({
    createMessageId,
    ellipsize,
    toTrimmedString,
}));

vi.mock("~codex/util/session.state.js", () => ({
    writeLatestSessionState,
}));

describe("Codex Stop hook", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        ensureRuntimeSession.mockResolvedValue({
            taskId: "task_1",
            sessionId: "session_1",
        });
        postTaggedEvent.mockResolvedValue(undefined);
        postJson.mockResolvedValue({});
        writeLatestSessionState.mockResolvedValue("");
    });

    it("records assistant response and completes the runtime session", async () => {
        readHookSessionContext.mockResolvedValue({
            payload: { last_assistant_message: "Done. Tests are green." },
            sessionId: "runtime_1",
        });

        await import("./Stop.js");
        await vi.waitFor(() => {
            expect(postTaggedEvent).toHaveBeenCalledTimes(1);
        });

        expect(postTaggedEvent).toHaveBeenCalledWith(expect.objectContaining({
            kind: "assistant.response",
            taskId: "task_1",
            sessionId: "session_1",
            title: "Done. Tests are green.",
            body: "Done. Tests are green.",
            metadata: expect.objectContaining({
                messageId: "assistant_msg_1",
                source: "codex-cli",
                stopReason: "stop_hook",
            }),
        }));

        expect(postJson).toHaveBeenCalledWith("/api/runtime-session-end", {
            runtimeSource: "codex-cli",
            runtimeSessionId: "runtime_1",
            summary: "Assistant turn completed (stop_hook)",
            completeTask: true,
            completionReason: "assistant_turn_complete",
        });
    });

    it("completes the runtime session even when there is no assistant message", async () => {
        readHookSessionContext.mockResolvedValue({
            payload: { last_assistant_message: "   " },
            sessionId: "runtime_2",
        });

        await import("./Stop.js");
        await vi.waitFor(() => {
            expect(postJson).toHaveBeenCalledTimes(1);
        });

        expect(ensureRuntimeSession).toHaveBeenCalledWith("runtime_2");
        expect(postTaggedEvent).toHaveBeenCalledWith(expect.objectContaining({
            kind: "assistant.response",
            taskId: "task_1",
            sessionId: "session_1",
            title: "Response (stop_hook)",
            metadata: expect.objectContaining({
                messageId: "assistant_msg_1",
                source: "codex-cli",
                stopReason: "stop_hook",
            }),
        }));
        expect(postJson).toHaveBeenCalledWith("/api/runtime-session-end", {
            runtimeSource: "codex-cli",
            runtimeSessionId: "runtime_2",
            summary: "Assistant turn completed (stop_hook)",
            completeTask: true,
            completionReason: "assistant_turn_complete",
        });
    });
});
