import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNestMonitorRuntime } from "./create-nestjs-monitor-runtime.js";
import type { MonitorRuntime } from "./runtime.type.js";

describe("createNestMonitorRuntime HTTP API", () => {
    let runtime: MonitorRuntime | undefined;
    let tempDir: string | undefined;

    function app() {
        if (!runtime) throw new Error("test runtime was not initialized");
        return runtime.app;
    }

    beforeEach(async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
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
                expect(body.task).toMatchObject({
                    id: "http-task-1",
                    title: "HTTP task",
                    status: "running",
                    runtimeSource: "vitest",
                });
                expect(typeof body.sessionId).toBe("string");
            });

        await request(app())
            .get("/api/tasks/http-task-1")
            .expect(200)
            .expect(({ body }) => {
                expect(body.task).toMatchObject({
                    id: "http-task-1",
                    title: "HTTP task",
                });
                expect(body.timeline).toEqual(expect.any(Array));
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
                expect(body).toEqual({ error: "playbook not found" });
            });
    });

    it("validates query parameters", async () => {
        await request(app())
            .get("/api/search")
            .expect(400)
            .expect(({ body }) => {
                expect(body.error).toBeDefined();
            });
    });
});
