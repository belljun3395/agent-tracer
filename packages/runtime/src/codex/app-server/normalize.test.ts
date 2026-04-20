import { describe, expect, it } from "vitest";
import { normalizeCodexAppServerNotification } from "./normalize.js";
import type { CodexAppServerNotification } from "./protocol.type.js";

const context = {
    taskId: "task_codex",
    sessionId: "sess_codex",
};

function normalize(notification: CodexAppServerNotification) {
    return normalizeCodexAppServerNotification(notification, context);
}

describe("normalizeCodexAppServerNotification", () => {
    it("maps thread/started to context.saved", () => {
        const events = normalize({
            method: "thread/started",
            params: {
                thread: {
                    id: "thr_123",
                    name: "Bug bash",
                    status: "active",
                    cwd: "/repo",
                    source: "appServer",
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "context.saved",
            taskId: "task_codex",
            sessionId: "sess_codex",
            lane: "planning",
            title: "Thread started: Bug bash",
            metadata: expect.objectContaining({
                threadId: "thr_123",
                threadStatus: "active",
                source: "codex-app-server",
            }),
        });
    });

    it("maps turn/started to action.logged", () => {
        const events = normalize({
            method: "turn/started",
            params: {
                threadId: "thr_123",
                turn: {
                    id: "turn_123",
                    status: "inProgress",
                    items: [],
                    error: null,
                    startedAt: 1713600000,
                    completedAt: null,
                    durationMs: null,
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "action.logged",
            lane: "planning",
            title: "Turn started",
            metadata: expect.objectContaining({
                threadId: "thr_123",
                turnId: "turn_123",
                turnStatus: "inProgress",
                source: "codex-app-server",
            }),
        });
    });

    it("maps failed turn/completed to verification.logged", () => {
        const events = normalize({
            method: "turn/completed",
            params: {
                threadId: "thr_123",
                turn: {
                    id: "turn_123",
                    status: "failed",
                    items: [],
                    error: {
                        message: "Context window exceeded",
                        codexErrorInfo: {
                            type: "ContextWindowExceeded",
                            httpStatusCode: 400,
                        },
                        additionalDetails: {
                            detail: "token budget exhausted",
                        },
                    },
                    startedAt: 1713600000,
                    completedAt: 1713600060,
                    durationMs: 60000,
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "verification.logged",
            lane: "planning",
            title: "Turn failed",
            body: "Context window exceeded",
            metadata: expect.objectContaining({
                verificationStatus: "failed",
                threadId: "thr_123",
                turnId: "turn_123",
                source: "codex-app-server",
            }),
        });
    });

    it("maps turn/plan/updated to plan.logged", () => {
        const events = normalize({
            method: "turn/plan/updated",
            params: {
                threadId: "thr_123",
                turnId: "turn_123",
                explanation: "Capture the high-signal lifecycle first.",
                plan: [
                    { step: "Normalize turn lifecycle", status: "completed" },
                    { step: "Normalize item lifecycle", status: "inProgress" },
                ],
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "plan.logged",
            lane: "planning",
            title: "Plan updated",
            body: expect.stringContaining("Capture the high-signal lifecycle first."),
            metadata: expect.objectContaining({
                threadId: "thr_123",
                turnId: "turn_123",
                source: "codex-app-server",
            }),
        });
    });

    it("maps item/started commandExecution to a lifecycle action", () => {
        const events = normalize({
            method: "item/started",
            params: {
                threadId: "thr_123",
                turnId: "turn_123",
                item: {
                    type: "commandExecution",
                    id: "item_123",
                    command: "npm test",
                    cwd: "/repo",
                    processId: null,
                    source: "agent",
                    status: "inProgress",
                    commandActions: [],
                    aggregatedOutput: null,
                    exitCode: null,
                    durationMs: null,
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "action.logged",
            lane: "implementation",
            title: "Command started: npm test",
            metadata: expect.objectContaining({
                itemId: "item_123",
                itemType: "commandExecution",
                turnId: "turn_123",
                threadId: "thr_123",
            }),
        });
    });

    it("maps item/completed commandExecution to terminal.command", () => {
        const events = normalize({
            method: "item/completed",
            params: {
                threadId: "thr_123",
                turnId: "turn_123",
                item: {
                    type: "commandExecution",
                    id: "item_123",
                    command: "npm test",
                    cwd: "/repo",
                    processId: "proc_123",
                    source: "agent",
                    status: "completed",
                    commandActions: [],
                    aggregatedOutput: "all green",
                    exitCode: 0,
                    durationMs: 5123,
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "terminal.command",
            lane: "implementation",
            title: "npm test",
            body: "npm test",
            metadata: expect.objectContaining({
                command: "npm test",
                threadId: "thr_123",
                turnId: "turn_123",
                itemId: "item_123",
                exitCode: 0,
                durationMs: 5123,
                source: "codex-app-server",
            }),
        });
    });

    it("maps item/completed fileChange to tool.used", () => {
        const events = normalize({
            method: "item/completed",
            params: {
                threadId: "thr_123",
                turnId: "turn_123",
                item: {
                    type: "fileChange",
                    id: "item_file",
                    status: "completed",
                    changes: [
                        {
                            path: "packages/runtime/src/codex/app-server/normalize.ts",
                            kind: { type: "update", move_path: null },
                            diff: "@@",
                        },
                    ],
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "tool.used",
            lane: "implementation",
            title: "File change: normalize.ts",
            metadata: expect.objectContaining({
                toolName: "fileChange",
                itemId: "item_file",
                threadId: "thr_123",
                turnId: "turn_123",
                source: "codex-app-server",
            }),
        });
        expect(events[0]?.filePaths).toEqual([
            "packages/runtime/src/codex/app-server/normalize.ts",
        ]);
    });

    it("maps item/completed mcpToolCall to agent.activity.logged", () => {
        const events = normalize({
            method: "item/completed",
            params: {
                threadId: "thr_123",
                turnId: "turn_123",
                item: {
                    type: "mcpToolCall",
                    id: "item_mcp",
                    server: "github",
                    tool: "fetch_pr",
                    status: "completed",
                    arguments: {
                        repo: "openai/codex",
                    },
                    result: {
                        ok: true,
                    },
                    error: null,
                    durationMs: 412,
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "agent.activity.logged",
            lane: "coordination",
            title: "MCP: github/fetch_pr",
            metadata: expect.objectContaining({
                activityType: "mcp_call",
                mcpServer: "github",
                mcpTool: "fetch_pr",
                itemId: "item_mcp",
                source: "codex-app-server",
            }),
        });
    });

    it("maps item/completed agentMessage to assistant.response", () => {
        const events = normalize({
            method: "item/completed",
            params: {
                threadId: "thr_123",
                turnId: "turn_123",
                item: {
                    type: "agentMessage",
                    id: "item_msg",
                    text: "Implemented the app-server normalizer.",
                    phase: "final_answer",
                    memoryCitation: null,
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            kind: "assistant.response",
            lane: "user",
            title: "Implemented the app-server normalizer.",
            body: "Implemented the app-server normalizer.",
            metadata: expect.objectContaining({
                messageId: "item_msg",
                phase: "final_answer",
                source: "codex-app-server",
            }),
        });
    });
});
