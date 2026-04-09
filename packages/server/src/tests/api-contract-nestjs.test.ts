import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type * as http from "node:http";
import { createNestMonitorRuntime } from "@monitor/server";
import type { MonitorRuntime } from "@monitor/server";
let runtime: MonitorRuntime;
let httpServer: http.Server;
beforeEach(async () => {
    runtime = await createNestMonitorRuntime({ databasePath: ":memory:" });
    httpServer = runtime.server;
});
afterEach(() => {
    runtime.close();
});
describe("NestJS API Contract Parity Tests", () => {
    it("GET /health — 200 with ok: true", async () => {
        const res = await request(httpServer).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("ok", true);
    });
    it("GET /api/overview — stats and observability", async () => {
        const res = await request(httpServer).get("/api/overview");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("stats");
        expect(res.body).toHaveProperty("observability");
    });
    it("GET /api/tasks — tasks array", async () => {
        const res = await request(httpServer).get("/api/tasks");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.tasks)).toBe(true);
    });
    it("GET /api/default-workspace — workspacePath string", async () => {
        const res = await request(httpServer).get("/api/default-workspace");
        expect(res.status).toBe(200);
        expect(typeof res.body.workspacePath).toBe("string");
    });
    it("GET /api/observability/overview", async () => {
        const res = await request(httpServer).get("/api/observability/overview");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("observability");
    });
    it("POST /api/task-start — creates task", async () => {
        const res = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "NestJS parity test" });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("task");
        expect(res.body.task).toHaveProperty("id");
        expect(res.body).toHaveProperty("events");
    });
    it("POST /api/task-start — 400 for missing title", async () => {
        const res = await request(httpServer).post("/api/task-start").send({});
        expect(res.status).toBe(400);
    });
    it("PATCH /api/tasks/:taskId — patches title", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Original" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer)
            .patch(`/api/tasks/${taskId}`)
            .send({ title: "Patched" });
        expect(res.status).toBe(200);
        expect(res.body.task.title).toBe("Patched");
    });
    it("DELETE /api/tasks/finished — returns count", async () => {
        const res = await request(httpServer).delete("/api/tasks/finished");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("ok", true);
        expect(typeof res.body.deleted).toBe("number");
    });
    it("DELETE /api/tasks/:taskId — deletes task", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "To delete" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer).delete(`/api/tasks/${taskId}`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
    it("DELETE /api/tasks/:taskId — 404 for nonexistent", async () => {
        const res = await request(httpServer).delete("/api/tasks/nonexistent-id");
        expect(res.status).toBe(404);
    });
    it("POST /api/runtime-session-ensure — creates session", async () => {
        const res = await request(httpServer)
            .post("/api/runtime-session-ensure")
            .send({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "nestjs-parity-session-1",
            title: "NestJS session"
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("taskId");
        expect(res.body).toHaveProperty("sessionId");
    });
    it("POST /api/runtime-session-ensure — 400 for missing fields", async () => {
        const res = await request(httpServer)
            .post("/api/runtime-session-ensure")
            .send({});
        expect(res.status).toBe(400);
    });
    it("POST /api/runtime-session-end — ends session", async () => {
        await request(httpServer)
            .post("/api/runtime-session-ensure")
            .send({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "nestjs-parity-session-end-1",
            title: "Runtime end test"
        });
        const res = await request(httpServer)
            .post("/api/runtime-session-end")
            .send({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "nestjs-parity-session-end-1"
        });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
    it("POST /api/tool-used — logs event", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Tool used parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer)
            .post("/api/tool-used")
            .send({ taskId, toolName: "Bash" });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("events");
    });
    it("POST /api/user-message — logs event", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "User message parity" });
        const taskId = start.body.task.id as string;
        const sessionId = start.body.sessionId as string;
        const res = await request(httpServer)
            .post("/api/user-message")
            .send({
            taskId,
            sessionId,
            messageId: "parity-msg-1",
            captureMode: "raw",
            source: "test",
            title: "Parity message"
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("events");
    });
    it("POST /api/user-message — 400 when sessionId missing", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "User message 400 parity" });
        const res = await request(httpServer)
            .post("/api/user-message")
            .send({
            taskId: start.body.task.id,
            messageId: "parity-msg-no-session",
            captureMode: "raw",
            source: "test",
            title: "No session"
        });
        expect(res.status).toBe(400);
    });
    it("PATCH /api/events/:eventId — updates displayTitle", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Event patch parity" });
        const taskId = start.body.task.id as string;
        const sessionId = start.body.sessionId as string;
        const msg = await request(httpServer)
            .post("/api/user-message")
            .send({
            taskId,
            sessionId,
            messageId: "parity-msg-patch",
            captureMode: "raw",
            source: "test",
            title: "Original"
        });
        const eventId = msg.body.events[0].id as string;
        const res = await request(httpServer)
            .patch(`/api/events/${eventId}`)
            .send({ displayTitle: "Patched" });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("event");
    });
    it("GET /api/bookmarks — returns array", async () => {
        const res = await request(httpServer).get("/api/bookmarks");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.bookmarks)).toBe(true);
    });
    it("POST /api/bookmarks — creates bookmark", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Bookmark parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer)
            .post("/api/bookmarks")
            .send({ taskId });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("bookmark");
    });
    it("DELETE /api/bookmarks/:bookmarkId — deletes bookmark", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Bookmark delete parity" });
        const taskId = start.body.task.id as string;
        const bm = await request(httpServer)
            .post("/api/bookmarks")
            .send({ taskId });
        const bookmarkId = bm.body.bookmark.id as string;
        const res = await request(httpServer).delete(`/api/bookmarks/${bookmarkId}`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
    it("DELETE /api/bookmarks/:bookmarkId — 404 for nonexistent", async () => {
        const res = await request(httpServer).delete("/api/bookmarks/nonexistent-id");
        expect(res.status).toBe(404);
    });
    it("GET /api/search — returns results", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Search parity task" });
        const taskId = start.body.task.id as string;
        const sessionId = start.body.sessionId as string;
        await request(httpServer)
            .post("/api/user-message")
            .send({
            taskId,
            sessionId,
            messageId: "search-parity-msg",
            captureMode: "raw",
            source: "test",
            title: "zxqwertyparity"
        });
        const res = await request(httpServer).get("/api/search?q=zxqwertyparity");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("tasks");
        expect(res.body).toHaveProperty("events");
        expect(res.body).toHaveProperty("bookmarks");
    });
    it("GET /api/search — 400 when q missing", async () => {
        const res = await request(httpServer).get("/api/search");
        expect(res.status).toBe(400);
    });
    it("POST /api/tasks/:id/evaluate — saves evaluation", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Evaluation parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer)
            .post(`/api/tasks/${taskId}/evaluate`)
            .send({ rating: "good" });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
    it("POST /api/tasks/:id/evaluate — 400 for invalid rating", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Invalid eval parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer)
            .post(`/api/tasks/${taskId}/evaluate`)
            .send({ rating: "invalid" });
        expect(res.status).toBe(400);
    });
    it("GET /api/tasks/:id/evaluate — returns null when no evaluation", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "No eval parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer).get(`/api/tasks/${taskId}/evaluate`);
        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });
    it("GET /api/workflows — returns array", async () => {
        const res = await request(httpServer).get("/api/workflows");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it("GET /api/workflows/similar — 400 when q missing", async () => {
        const res = await request(httpServer).get("/api/workflows/similar");
        expect(res.status).toBe(400);
    });
    it("GET /api/workflows/similar — returns results for query", async () => {
        const res = await request(httpServer).get("/api/workflows/similar?q=refactor");
        expect(res.status).toBe(200);
    });
    it("GET /api/workflows/:id/content — 404 for nonexistent", async () => {
        const res = await request(httpServer).get("/api/workflows/nonexistent-id/content");
        expect(res.status).toBe(404);
    });
    it("GET /api/tasks/:taskId — 404 for nonexistent", async () => {
        const res = await request(httpServer).get("/api/tasks/nonexistent-id");
        expect(res.status).toBe(404);
    });
    it("GET /api/tasks/:taskId — returns task + timeline", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Task detail parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer).get(`/api/tasks/${taskId}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("task");
        expect(res.body).toHaveProperty("timeline");
    });
    it("GET /api/tasks/:taskId/observability — returns data", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "Observability parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer).get(`/api/tasks/${taskId}/observability`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("observability");
    });
    it("GET /api/tasks/:taskId/openinference — returns data", async () => {
        const start = await request(httpServer)
            .post("/api/task-start")
            .send({ title: "OpenInference parity" });
        const taskId = start.body.task.id as string;
        const res = await request(httpServer).get(`/api/tasks/${taskId}/openinference`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("openinference");
    });
});
