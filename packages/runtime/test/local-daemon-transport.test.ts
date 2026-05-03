import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createMonitorTransport} from "~shared/hook-runtime/transport.js";

const OLD_ENV = {...process.env};
const servers: net.Server[] = [];

function socketPath(name: string): string {
    return path.join(os.tmpdir(), `${name}-${process.pid}.sock`);
}

async function startCaptureServer(sock: string): Promise<{messages: unknown[]; close: () => Promise<void>}> {
    const messages: unknown[] = [];
    const server = net.createServer((socket) => {
        let buffer = "";
        socket.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            for (;;) {
                const index = buffer.indexOf("\n");
                if (index === -1) break;
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                if (line) messages.push(JSON.parse(line));
            }
        });
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(sock, () => {
            server.off("error", reject);
            resolve();
        });
    });
    return {
        messages,
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
}

beforeEach(() => {
    process.env = {...OLD_ENV};
    process.env.MONITOR_TRANSPORT = "daemon";
    process.env.AGENT_TRACER_DAEMON_AUTOSTART = "0";
});

afterEach(async () => {
    process.env = {...OLD_ENV};
    for (const server of servers.splice(0)) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

describe("local daemon monitor transport", () => {
    it("returns deterministic local ids for session ensure and enqueues the HTTP request over UDS", async () => {
        const sock = socketPath("agent-tracer-daemon-test-ensure");
        const capture = await startCaptureServer(sock);
        process.env.AGENT_TRACER_DAEMON_SOCKET = sock;

        const transport = createMonitorTransport();
        const result = await transport.postJson("/ingest/v1/sessions/ensure", {
            runtimeSource: "claude-code",
            runtimeSessionId: "runtime-session-1",
            title: "Test task",
            workspacePath: "/tmp/project",
        });

        expect(result).toEqual({
            taskId: expect.stringMatching(/^[0-9a-f-]{36}$/),
            sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
            taskCreated: false,
            sessionCreated: false,
        });

        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(capture.messages).toEqual([
            {
                type: "postJson",
                pathname: "/ingest/v1/sessions/ensure",
                body: {
                    runtimeSource: "claude-code",
                    runtimeSessionId: "runtime-session-1",
                    title: "Test task",
                    workspacePath: "/tmp/project",
                },
                localResult: result,
            },
        ]);
    });

    it("fire-and-forgets tagged events to the daemon without waiting for monitor HTTP", async () => {
        const sock = socketPath("agent-tracer-daemon-test-event");
        const capture = await startCaptureServer(sock);
        process.env.AGENT_TRACER_DAEMON_SOCKET = sock;

        const transport = createMonitorTransport();
        await transport.postTaggedEvent({
            kind: "context.saved",
            taskId: "task-1",
            sessionId: "session-1",
            title: "Saved",
            lane: "planning",
            metadata: {},
        });

        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(capture.messages).toHaveLength(1);
        expect(capture.messages[0]).toMatchObject({
            type: "postJson",
            pathname: expect.stringContaining("/ingest/v1/"),
            body: {
                events: [expect.objectContaining({
                    kind: "context.saved",
                    taskId: "task-1",
                    sessionId: "session-1",
                    metadata: expect.any(Object),
                })],
            },
        });
    });
});
