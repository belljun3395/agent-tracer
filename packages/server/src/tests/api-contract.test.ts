/**
 * @module tests/api-contract
 *
 * API 계약 테스트 — 모든 엔드포인트의 메서드, 경로, 응답 형태를 검증한다.
 * Express 앱에 대해 실행되며, NestJS 마이그레이션 이후에도 동일한 계약이
 * 유지되는지 확인하는 게이트 역할을 한다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { MonitorRuntime } from "../bootstrap/create-monitor-runtime.js";
import { createMonitorRuntime } from "../bootstrap/create-monitor-runtime.js";

function createHarness(): MonitorRuntime {
  return createMonitorRuntime({ databasePath: ":memory:" });
}

describe("API Contract Tests — all endpoints", () => {
  let runtime: MonitorRuntime;

  beforeEach(() => {
    runtime = createHarness();
  });

  afterEach(() => {
    runtime.close();
  });

  // ── Admin / Health ──────────────────────────────────────────────────────────

  describe("GET /health", () => {
    it("returns 200 with ok: true", async () => {
      const res = await request(runtime.app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
    });
  });

  describe("GET /api/overview", () => {
    it("returns stats and observability", async () => {
      const res = await request(runtime.app).get("/api/overview");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("stats");
      expect(res.body).toHaveProperty("observability");
    });
  });

  describe("GET /api/tasks", () => {
    it("returns tasks array", async () => {
      const res = await request(runtime.app).get("/api/tasks");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tasks");
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });
  });

  describe("GET /api/default-workspace", () => {
    it("returns workspacePath string", async () => {
      const res = await request(runtime.app).get("/api/default-workspace");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("workspacePath");
      expect(typeof res.body.workspacePath).toBe("string");
    });
  });

  describe("GET /api/tasks/:taskId", () => {
    it("returns 404 for nonexistent task", async () => {
      const res = await request(runtime.app).get("/api/tasks/nonexistent-id");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("returns task, timeline, and optional runtimeSessionId for existing task", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Contract test task" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app).get(`/api/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("task");
      expect(res.body).toHaveProperty("timeline");
      expect(res.body.task.id).toBe(taskId);
    });
  });

  describe("GET /api/tasks/:taskId/observability", () => {
    it("returns 404 for nonexistent task", async () => {
      const res = await request(runtime.app).get("/api/tasks/nonexistent-id/observability");
      expect(res.status).toBe(404);
    });

    it("returns observability data for existing task", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Observability task" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app).get(`/api/tasks/${taskId}/observability`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("observability");
    });
  });

  describe("GET /api/tasks/:taskId/openinference", () => {
    it("returns 404 for nonexistent task", async () => {
      const res = await request(runtime.app).get("/api/tasks/nonexistent-id/openinference");
      expect(res.status).toBe(404);
    });

    it("returns openinference export for existing task", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "OpenInference task" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app).get(`/api/tasks/${taskId}/openinference`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("openinference");
    });
  });

  describe("GET /api/observability/overview", () => {
    it("returns observability overview", async () => {
      const res = await request(runtime.app).get("/api/observability/overview");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("observability");
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  describe("POST /api/task-start", () => {
    it("creates a task and returns envelope", async () => {
      const res = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Contract test" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("task");
      expect(res.body.task).toHaveProperty("id");
      expect(res.body.task).toHaveProperty("title", "Contract test");
      expect(res.body).toHaveProperty("events");
    });

    it("returns 400 for missing title", async () => {
      const res = await request(runtime.app)
        .post("/api/task-start")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/task-link", () => {
    it("links an existing task and returns it", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Task to link" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/task-link")
        .send({ taskId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("task");
      expect(res.body.task.id).toBe(taskId);
    });

    it("returns 400 for missing taskId", async () => {
      const res = await request(runtime.app)
        .post("/api/task-link")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/task-complete", () => {
    it("completes a task", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Task to complete" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/task-complete")
        .send({ taskId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("task");
    });
  });

  describe("POST /api/task-error", () => {
    it("marks a task as errored", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Task to error" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/task-error")
        .send({ taskId, errorMessage: "Something went wrong" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("task");
    });
  });

  describe("PATCH /api/tasks/:taskId", () => {
    it("patches a task title", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Original title" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .patch(`/api/tasks/${taskId}`)
        .send({ title: "Updated title" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("task");
      expect(res.body.task.title).toBe("Updated title");
    });

    it("returns 404 for nonexistent task", async () => {
      const res = await request(runtime.app)
        .patch("/api/tasks/nonexistent-id")
        .send({ title: "New title" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tasks/finished", () => {
    it("deletes finished tasks and returns count", async () => {
      const res = await request(runtime.app).delete("/api/tasks/finished");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
      expect(res.body).toHaveProperty("deleted");
      expect(typeof res.body.deleted).toBe("number");
    });
  });

  describe("DELETE /api/tasks/:taskId", () => {
    it("deletes an existing task", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Task to delete" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app).delete(`/api/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
    });

    it("returns 404 for nonexistent task", async () => {
      const res = await request(runtime.app).delete("/api/tasks/nonexistent-id");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("ok", false);
    });
  });

  describe("POST /api/session-end", () => {
    it("ends a session", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Session end test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/session-end")
        .send({ taskId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("sessionId");
      expect(res.body).toHaveProperty("task");
    });
  });

  describe("POST /api/runtime-session-ensure", () => {
    it("ensures a runtime session", async () => {
      const res = await request(runtime.app)
        .post("/api/runtime-session-ensure")
        .send({
          runtimeSource: "claude-hook",
          runtimeSessionId: "contract-test-session-1",
          title: "Contract test runtime session"
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("taskId");
      expect(res.body).toHaveProperty("sessionId");
      expect(res.body).toHaveProperty("taskCreated");
      expect(res.body).toHaveProperty("sessionCreated");
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(runtime.app)
        .post("/api/runtime-session-ensure")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/runtime-session-end", () => {
    it("ends a runtime session", async () => {
      await request(runtime.app)
        .post("/api/runtime-session-ensure")
        .send({
          runtimeSource: "claude-hook",
          runtimeSessionId: "contract-test-session-end-1",
          title: "Runtime session end test"
        });

      const res = await request(runtime.app)
        .post("/api/runtime-session-end")
        .send({
          runtimeSource: "claude-hook",
          runtimeSessionId: "contract-test-session-end-1"
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(runtime.app)
        .post("/api/runtime-session-end")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Event ───────────────────────────────────────────────────────────────────

  describe("POST /api/tool-used", () => {
    it("logs a tool-used event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Tool used test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/tool-used")
        .send({ taskId, toolName: "Read", title: "Reading file" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/terminal-command", () => {
    it("logs a terminal command event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Terminal command test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/terminal-command")
        .send({ taskId, command: "npm run build" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/save-context", () => {
    it("logs a save-context event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Save context test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/save-context")
        .send({ taskId, title: "Context saved" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/explore", () => {
    it("logs an exploration event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Explore test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/explore")
        .send({ taskId, toolName: "Glob", title: "Exploring files" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/plan", () => {
    it("logs a plan event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Plan test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/plan")
        .send({ taskId, action: "plan step 1" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/action", () => {
    it("logs an action event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Action test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/action")
        .send({ taskId, action: "implement step 1" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/verify", () => {
    it("logs a verify event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Verify test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/verify")
        .send({ taskId, action: "run tests", result: "pass" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/rule", () => {
    it("logs a rule event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Rule test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/rule")
        .send({
          taskId,
          action: "check rule",
          ruleId: "rule-1",
          severity: "warn",
          status: "pass"
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/async-task", () => {
    it("logs an async lifecycle event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Async task test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/async-task")
        .send({ taskId, asyncTaskId: "async-1", asyncStatus: "running" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/agent-activity", () => {
    it("logs an agent activity event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Agent activity test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/agent-activity")
        .send({ taskId, activityType: "agent_step" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/user-message", () => {
    it("logs a user message event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "User message test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(runtime.app)
        .post("/api/user-message")
        .send({
          taskId,
          sessionId,
          messageId: "msg-contract-1",
          captureMode: "raw",
          source: "test",
          title: "Test user message"
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });

    it("returns 400 when sessionId is missing", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "User message validation test" });

      const res = await request(runtime.app)
        .post("/api/user-message")
        .send({
          taskId: start.body.task.id,
          messageId: "msg-no-session",
          captureMode: "raw",
          source: "test",
          title: "Missing session"
        });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/question", () => {
    it("logs a question event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Question test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/question")
        .send({ taskId, questionId: "q-1", questionPhase: "asked", title: "Is this correct?" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/todo", () => {
    it("logs a todo event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Todo test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/todo")
        .send({ taskId, todoId: "todo-1", todoState: "added", title: "Do the thing" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/thought", () => {
    it("logs a thought event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Thought test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/thought")
        .send({ taskId, title: "I should refactor this" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("POST /api/assistant-response", () => {
    it("logs an assistant response event", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Assistant response test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(runtime.app)
        .post("/api/assistant-response")
        .send({
          taskId,
          sessionId,
          messageId: "assistant-msg-1",
          source: "claude",
          title: "Here is my answer"
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  describe("PATCH /api/events/:eventId", () => {
    it("updates event displayTitle", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Event patch test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const msg = await request(runtime.app)
        .post("/api/user-message")
        .send({
          taskId,
          sessionId,
          messageId: "msg-patch-1",
          captureMode: "raw",
          source: "test",
          title: "Original title"
        });
      const eventId = msg.body.events[0].id as string;

      const res = await request(runtime.app)
        .patch(`/api/events/${eventId}`)
        .send({ displayTitle: "Patched title" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("event");
    });

    it("returns 404 for nonexistent event", async () => {
      const res = await request(runtime.app)
        .patch("/api/events/nonexistent-id")
        .send({ displayTitle: "Some title" });
      expect(res.status).toBe(404);
    });
  });

  // ── Bookmark ────────────────────────────────────────────────────────────────

  describe("GET /api/bookmarks", () => {
    it("returns bookmarks array", async () => {
      const res = await request(runtime.app).get("/api/bookmarks");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("bookmarks");
      expect(Array.isArray(res.body.bookmarks)).toBe(true);
    });

    it("filters by taskId", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Bookmark filter test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app).get(`/api/bookmarks?taskId=${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("bookmarks");
    });
  });

  describe("POST /api/bookmarks", () => {
    it("creates a bookmark", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Bookmark creation test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post("/api/bookmarks")
        .send({ taskId, title: "Important spot" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("bookmark");
      expect(res.body.bookmark).toHaveProperty("id");
    });
  });

  describe("DELETE /api/bookmarks/:bookmarkId", () => {
    it("deletes a bookmark", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Bookmark delete test" });
      const taskId = start.body.task.id as string;

      const bm = await request(runtime.app)
        .post("/api/bookmarks")
        .send({ taskId });
      const bookmarkId = bm.body.bookmark.id as string;

      const res = await request(runtime.app).delete(`/api/bookmarks/${bookmarkId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
    });

    it("returns 404 for nonexistent bookmark", async () => {
      const res = await request(runtime.app).delete("/api/bookmarks/nonexistent-id");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("ok", false);
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  describe("GET /api/search", () => {
    it("returns search results", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Searchable task" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      await request(runtime.app)
        .post("/api/user-message")
        .send({
          taskId,
          sessionId,
          messageId: "msg-search-1",
          captureMode: "raw",
          source: "test",
          title: "Unique searchable content zxqwerty"
        });

      const res = await request(runtime.app).get("/api/search?q=zxqwerty");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tasks");
      expect(res.body).toHaveProperty("events");
      expect(res.body).toHaveProperty("bookmarks");
    });

    it("returns 400 when q is missing", async () => {
      const res = await request(runtime.app).get("/api/search");
      expect(res.status).toBe(400);
    });
  });

  // ── Evaluation ──────────────────────────────────────────────────────────────

  describe("POST /api/tasks/:id/evaluate", () => {
    it("saves an evaluation", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Evaluation test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post(`/api/tasks/${taskId}/evaluate`)
        .send({ rating: "good", useCase: "contract test" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ok", true);
    });

    it("returns 400 for invalid rating", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Invalid eval test" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app)
        .post(`/api/tasks/${taskId}/evaluate`)
        .send({ rating: "invalid" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/tasks/:id/evaluate", () => {
    it("returns null when no evaluation exists", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "No eval task" });
      const taskId = start.body.task.id as string;

      const res = await request(runtime.app).get(`/api/tasks/${taskId}/evaluate`);
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("returns evaluation when one exists", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Has eval task" });
      const taskId = start.body.task.id as string;

      await request(runtime.app)
        .post(`/api/tasks/${taskId}/evaluate`)
        .send({ rating: "good", useCase: "retrieval test" });

      const res = await request(runtime.app).get(`/api/tasks/${taskId}/evaluate`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("taskId", taskId);
      expect(res.body).toHaveProperty("rating", "good");
    });
  });

  describe("GET /api/workflows", () => {
    it("returns evaluations list", async () => {
      const res = await request(runtime.app).get("/api/workflows");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("filters by rating", async () => {
      const res = await request(runtime.app).get("/api/workflows?rating=good");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/workflows/similar", () => {
    it("returns 400 when q is missing", async () => {
      const res = await request(runtime.app).get("/api/workflows/similar");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns similar workflows for a query", async () => {
      const res = await request(runtime.app).get("/api/workflows/similar?q=refactor");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/workflows/:id/content", () => {
    it("returns 404 for nonexistent workflow", async () => {
      const res = await request(runtime.app).get("/api/workflows/nonexistent-id/content");
      expect(res.status).toBe(404);
    });

    it("returns content for an evaluated workflow", async () => {
      const start = await request(runtime.app)
        .post("/api/task-start")
        .send({ title: "Workflow content test" });
      const taskId = start.body.task.id as string;

      await request(runtime.app)
        .post(`/api/tasks/${taskId}/evaluate`)
        .send({
          rating: "good",
          workflowContext: "# Test workflow\n\nSome context here."
        });

      const res = await request(runtime.app).get(`/api/workflows/${taskId}/content`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("taskId", taskId);
    });
  });
});
