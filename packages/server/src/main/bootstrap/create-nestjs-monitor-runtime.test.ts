import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import WebSocket from "ws";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createNestMonitorRuntime } from "./create-nestjs-monitor-runtime.js";
import type { MonitorRuntime } from "./runtime.type.js";

describe("createNestMonitorRuntime HTTP API", () => {
    let runtime: MonitorRuntime | undefined;
    let tempDir: string | undefined;
    let stdoutSpy: MockInstance<typeof process.stdout.write>;

    function app() {
        if (!runtime) throw new Error("test runtime was not initialized");
        return runtime.app;
    }

    beforeEach(async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        tempDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-server-"));
        runtime = await createNestMonitorRuntime({
            databasePath: path.join(tempDir, "monitor.sqlite"),
        });
    });

    afterEach(async () => {
        await runtime?.close();
        runtime = undefined;
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
            tempDir = undefined;
        }
        vi.restoreAllMocks();
    });

    it("serves health checks", async () => {
        await request(app())
            .get("/health")
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({ ok: true });
            });
    });

    it("adds request ids and logs normalized HTTP access", async () => {
        await request(app())
            .get("/health")
            .set("x-request-id", "request-context-test")
            .set("x-forwarded-for", "203.0.113.10, 10.0.0.5")
            .expect("x-request-id", "request-context-test")
            .expect(200);

        expect(parsedInfoLogs()).toContainEqual(expect.objectContaining({
            type: "http_access",
            requestId: "request-context-test",
            method: "GET",
            path: "/health",
            statusCode: 200,
            clientIp: "203.0.113.10",
        }));
    });

    it("logs websocket upgrades with request context outside Nest middleware", async () => {
        if (!runtime) throw new Error("test runtime was not initialized");
        const port = await listenOnRandomPort(runtime.server);
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
            headers: {
                "x-request-id": "ws-request-context-test",
                "x-forwarded-for": "203.0.113.20",
            },
        });

        await waitForWebSocketMessage(ws);
        ws.close();

        expect(parsedInfoLogs()).toContainEqual(expect.objectContaining({
            type: "http_upgrade",
            requestId: "ws-request-context-test",
            path: "/ws",
            accepted: true,
            clientIp: "203.0.113.20",
        }));
    });

    it("creates and reads a task through the HTTP API", async () => {
        await request(app())
            .post("/api/task-start")
            .send({
                taskId: "http-task-1",
                title: "HTTP task",
                runtimeSource: "vitest",
            })
            .expect(200)
            .expect(({ body }) => {
                expect(body).toMatchObject({ ok: true });
                expect(body.data.task).toMatchObject({
                    id: "http-task-1",
                    title: "HTTP task",
                    status: "running",
                    runtimeSource: "vitest",
                });
                expect(typeof body.data.sessionId).toBe("string");
            });

        await request(app())
            .get("/api/tasks/http-task-1")
            .expect(200)
            .expect(({ body }) => {
                expect(body).toMatchObject({ ok: true });
                expect(body.data.task).toMatchObject({
                    id: "http-task-1",
                    title: "HTTP task",
                });
                expect(body.data.timeline).toEqual(expect.any(Array));
            });
    });

    it("wraps successful API responses in a consistent envelope", async () => {
        await request(app())
            .get("/api/tasks")
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual({
                    ok: true,
                    data: {
                        tasks: expect.any(Array),
                    },
                });
            });
    });

    it("validates ingest request bodies before writing events", async () => {
        await request(app())
            .post("/ingest/v1/events")
            .send({ events: [] })
            .expect(400)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    ok: false,
                    error: {
                        code: "validation_error",
                    },
                });
            });
    });

    it("validates path parameters before route handlers run", async () => {
        await request(app())
            .get("/api/tasks/%20")
            .expect(400)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    ok: false,
                    error: {
                        code: "validation_error",
                        message: "Invalid path parameter",
                    },
                });
            });
    });

    it("ingests events for an existing task", async () => {
        await request(app())
            .post("/api/task-start")
            .send({
                taskId: "http-task-2",
                title: "Task with events",
            })
            .expect(200);

        await request(app())
            .post("/ingest/v1/events")
            .send({
                events: [
                    {
                        kind: "plan.logged",
                        taskId: "http-task-2",
                        lane: "planning",
                        title: "Plan",
                        body: "Test plan",
                    },
                ],
            })
            .expect(200)
            .expect(({ body }) => {
                expect(body.ok).toBe(true);
                expect(body.data).toEqual(expect.any(Object));
            });
    });

    it("returns not found for missing playbooks", async () => {
        await request(app())
            .get("/api/playbooks/missing-playbook")
            .expect(404)
            .expect(({ body }) => {
                expect(body).toEqual({
                    ok: false,
                    error: {
                        code: "not_found",
                        message: "playbook not found",
                    },
                });
            });
    });

    it("validates query parameters", async () => {
        await request(app())
            .get("/api/search")
            .expect(400)
            .expect(({ body }) => {
                expect(body).toMatchObject({
                    ok: false,
                    error: {
                        code: "validation_error",
                    },
                });
            });
    });

    function parsedInfoLogs(): readonly Record<string, unknown>[] {
        return stdoutSpy.mock.calls.flatMap((args) => {
            const [chunk] = args as [string | Uint8Array];
            if (typeof chunk !== "string") return [];
            return chunk
                .split("\n")
                .flatMap((line) => {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("{")) return [];
                    try {
                        return [JSON.parse(trimmed) as Record<string, unknown>];
                    } catch {
                        return [];
                    }
                });
        });
    }
});

async function listenOnRandomPort(server: MonitorRuntime["server"]): Promise<number> {
    if (!server.listening) {
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    }
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind to a TCP port");
    return (address as AddressInfo).port;
}

async function waitForWebSocketMessage(ws: WebSocket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        ws.once("message", () => resolve());
        ws.once("error", reject);
    });
}
