import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createMonitoringHttpServer } from "../../src/presentation/create-app.js";
import type { Express } from "express";

/**
 * HTTP 엔드포인트 통합 테스트.
 * 실제 in-memory DB + 실제 Express 서버 사용.
 */
describe("HTTP API", () => {
  let app: Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("GET /health → 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/task-start → 태스크 생성", async () => {
    const res = await request(app)
      .post("/api/task-start")
      .send({ title: "My Task" });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe("My Task");
    expect(res.body.task.status).toBe("running");
  });

  it("GET /api/tasks/:id → 404 없는 태스크", async () => {
    const res = await request(app).get("/api/tasks/no-such-id");
    expect(res.status).toBe(404);
  });

  it("POST /api/task-start + GET /api/tasks/:id 라운드트립", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "Round Trip" });
    const taskId = start.body.task.id as string;

    const get = await request(app).get(`/api/tasks/${taskId}`);
    expect(get.status).toBe(200);
    expect(get.body.task.id).toBe(taskId);
  });

  it("POST /api/task-link 에 title을 주면 태스크 제목이 함께 갱신된다", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "OpenCode - agent-tracer" });
    const taskId = start.body.task.id as string;

    const linked = await request(app)
      .post("/api/task-link")
      .send({
        taskId,
        title: "Inspect git internals",
        taskKind: "background"
      });

    expect(linked.status).toBe(200);
    expect(linked.body.task.title).toBe("Inspect git internals");
    expect(linked.body.task.taskKind).toBe("background");
  });

  it("DELETE 실행 중인 태스크도 강제 삭제 → 200", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "Running" });
    const taskId = start.body.task.id as string;

    const del = await request(app).delete(`/api/tasks/${taskId}`);
    expect(del.status).toBe(200);
  });

  it("DELETE 부모 태스크 시 자식 태스크도 함께 삭제된다", async () => {
    const parent = await request(app)
      .post("/api/task-start")
      .send({ title: "Parent For Cascade" });
    const parentId = parent.body.task.id as string;

    const child = await request(app)
      .post("/api/task-start")
      .send({
        title: "Child For Cascade",
        taskKind: "background",
        parentTaskId: parentId
      });
    const childId = child.body.task.id as string;

    const del = await request(app).delete(`/api/tasks/${parentId}`);
    expect(del.status).toBe(200);

    const childGet = await request(app).get(`/api/tasks/${childId}`);
    expect(childGet.status).toBe(404);
  });

  it("잘못된 요청 본문 → 400", async () => {
    const res = await request(app)
      .post("/api/task-start")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });

  describe("POST /api/user-message — 캐노니컬 user.message", () => {
    it("raw 메시지를 기록한다 → 200", async () => {
      const start = await request(app)
        .post("/api/task-start")
        .send({ title: "User Message Test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(app)
        .post("/api/user-message")
        .send({
          taskId,
          sessionId,
          messageId: "msg-1",
          captureMode: "raw",
          source: "manual-mcp",
          phase: "initial",
          title: "User prompt"
        });
      expect(res.status).toBe(200);
      expect(res.body.events[0].kind).toBe("user.message");
    });

    it("derived 페이로드에 sourceEventId 누락 → 400", async () => {
      const start = await request(app)
        .post("/api/task-start")
        .send({ title: "Derived Test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(app)
        .post("/api/user-message")
        .send({
          taskId,
          sessionId,
          messageId: "msg-derived",
          captureMode: "derived",
          source: "manual-mcp",
          title: "Derived without sourceEventId"
        });
      expect(res.status).toBe(400);
    });

    it("sessionId 누락 → 400 (sessionId는 모든 호출자에게 필수)", async () => {
      const start = await request(app)
        .post("/api/task-start")
        .send({ title: "Missing SessionId Test" });
      const taskId = start.body.task.id as string;

      const res = await request(app)
        .post("/api/user-message")
        .send({
          taskId,
          // sessionId 누락
          messageId: "msg-no-session",
          captureMode: "raw",
          source: "manual-mcp",
          title: "No sessionId provided"
        });
      expect(res.status).toBe(400);
    });

    it("messageId 누락 → 400", async () => {
      const start = await request(app)
        .post("/api/task-start")
        .send({ title: "Missing messageId Test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(app)
        .post("/api/user-message")
        .send({
          taskId,
          sessionId,
          // messageId 누락
          captureMode: "raw",
          source: "manual-mcp",
          title: "No messageId"
        });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/session-end — 세션 종료 연속성", () => {
    it("세션 종료 후 태스크는 running 상태를 유지한다", async () => {
      const start = await request(app)
        .post("/api/task-start")
        .send({ title: "Session End Test" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(app)
        .post("/api/session-end")
        .send({ taskId, sessionId });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe("running");
      expect(res.body.sessionId).toBe(sessionId);
    });

    it("세션 재시작 후 두 raw 메시지가 같은 태스크에 누적된다", async () => {
      // 첫 번째 세션
      const start1 = await request(app)
        .post("/api/task-start")
        .send({ title: "Continuity Test", taskId: "work-item-cont-1" });
      const taskId = start1.body.task.id as string;
      const sessionId1 = start1.body.sessionId as string;

      await request(app)
        .post("/api/user-message")
        .send({
          taskId, sessionId: sessionId1,
          messageId: "msg-1", captureMode: "raw",
          source: "manual-mcp", phase: "initial",
          title: "First prompt"
        });

      await request(app)
        .post("/api/session-end")
        .send({ taskId, sessionId: sessionId1 });

      // 두 번째 세션 (같은 taskId)
      const start2 = await request(app)
        .post("/api/task-start")
        .send({ title: "Continuity Test", taskId });
      const sessionId2 = start2.body.sessionId as string;
      expect(sessionId2).not.toBe(sessionId1);

      await request(app)
        .post("/api/user-message")
        .send({
          taskId, sessionId: sessionId2,
          messageId: "msg-2", captureMode: "raw",
          source: "manual-mcp", phase: "follow_up",
          title: "Follow-up prompt"
        });

      const detail = await request(app).get(`/api/tasks/${taskId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.task.status).toBe("running");
      const userMessages = (detail.body.timeline as Array<{ kind: string }>)
        .filter(e => e.kind === "user.message");
      expect(userMessages).toHaveLength(2);
    });

    it("completeTask=true 이면 primary 태스크를 completed로 전이한다", async () => {
      const start = await request(app)
        .post("/api/task-start")
        .send({ title: "Complete On Exit" });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(app)
        .post("/api/session-end")
        .send({ taskId, sessionId, completeTask: true });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe("completed");
    });

    it("background taskKind 태스크는 session-end 시 completed가 된다", async () => {
      const parent = await request(app)
        .post("/api/task-start")
        .send({ title: "Parent task" });

      const start = await request(app)
        .post("/api/task-start")
        .send({
          title: "Background Session End",
          taskKind: "background",
          parentTaskId: parent.body.task.id
        });
      const taskId = start.body.task.id as string;
      const sessionId = start.body.sessionId as string;

      const res = await request(app)
        .post("/api/session-end")
        .send({ taskId, sessionId });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe("completed");
      expect(res.body.task.taskKind).toBe("background");
      expect(res.body.task.parentTaskId).toBe(parent.body.task.id);
    });
  });
});

describe("POST /api/question — question.logged", () => {
  let app: import("express").Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("asked 단계 → user 레인 이벤트 기록", async () => {
    const start = await request(app).post("/api/task-start").send({ title: "Q Test" });
    const taskId = start.body.task.id as string;
    const sessionId = start.body.sessionId as string;

    const res = await request(app).post("/api/question").send({
      taskId, sessionId,
      questionId: "q-1", questionPhase: "asked",
      title: "Which approach?"
    });
    expect(res.status).toBe(200);
    expect(res.body.events[0].kind).toBe("question.logged");
  });

  it("questionId 누락 → 400", async () => {
    const start = await request(app).post("/api/task-start").send({ title: "Q Test" });
    const res = await request(app).post("/api/question").send({
      taskId: start.body.task.id, questionPhase: "asked", title: "?"
      // questionId 누락
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/todo — todo.logged", () => {
  let app: import("express").Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("todo 이벤트를 기록한다", async () => {
    const start = await request(app).post("/api/task-start").send({ title: "Todo Test" });
    const taskId = start.body.task.id as string;
    const sessionId = start.body.sessionId as string;

    const res = await request(app).post("/api/todo").send({
      taskId, sessionId,
      todoId: "t-1", todoState: "added",
      title: "Implement feature"
    });
    expect(res.status).toBe(200);
    expect(res.body.events[0].kind).toBe("todo.logged");
  });
});

describe("POST /api/thought — thought.logged", () => {
  let app: import("express").Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("thought 이벤트를 기록한다", async () => {
    const start = await request(app).post("/api/task-start").send({ title: "Thought Test" });
    const taskId = start.body.task.id as string;
    const sessionId = start.body.sessionId as string;

    const res = await request(app).post("/api/thought").send({
      taskId, sessionId,
      title: "Analysis",
      body: "The root cause is...",
      modelName: "claude-opus-4-6"
    });
    expect(res.status).toBe(200);
    expect(res.body.events[0].kind).toBe("thought.logged");
  });
});

describe("POST /api/runtime-session-ensure", () => {
  let app: import("express").Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("creates task and session on first call", async () => {
    const res = await request(app)
      .post("/api/runtime-session-ensure")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-1", title: "Test Task" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ taskCreated: true, sessionCreated: true });
    expect(res.body.taskId).toBeDefined();
    expect(res.body.sessionId).toBeDefined();
  });

  it("is idempotent on repeated calls", async () => {
    const first = await request(app)
      .post("/api/runtime-session-ensure")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-2", title: "Test Task" });
    const second = await request(app)
      .post("/api/runtime-session-ensure")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-2", title: "Test Task" });
    expect(second.body.taskId).toBe(first.body.taskId);
    expect(second.body.sessionId).toBe(first.body.sessionId);
    expect(second.body.taskCreated).toBe(false);
    expect(second.body.sessionCreated).toBe(false);
  });

  it("reopens session after end", async () => {
    const ensure1 = await request(app)
      .post("/api/runtime-session-ensure")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-3", title: "Test Task" });
    await request(app)
      .post("/api/runtime-session-end")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-3" });
    const ensure2 = await request(app)
      .post("/api/runtime-session-ensure")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-3", title: "Test Task" });
    expect(ensure2.body.taskId).toBe(ensure1.body.taskId);
    expect(ensure2.body.sessionId).not.toBe(ensure1.body.sessionId);
    expect(ensure2.body.taskCreated).toBe(false);
    expect(ensure2.body.sessionCreated).toBe(true);
  });
});

describe("POST /api/runtime-session-end", () => {
  let app: import("express").Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("is idempotent (double end is harmless)", async () => {
    await request(app)
      .post("/api/runtime-session-ensure")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-end", title: "Test Task" });
    const end1 = await request(app)
      .post("/api/runtime-session-end")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-end" });
    const end2 = await request(app)
      .post("/api/runtime-session-end")
      .send({ runtimeSource: "test-adapter", runtimeSessionId: "sess-end" });
    expect(end1.status).toBe(200);
    expect(end2.status).toBe(200);
  });
});

describe("Agent activity, bookmarks, and search API", () => {
  let app: import("express").Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("POST /api/agent-activity → coordination 이벤트를 기록한다", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "Agent Activity Test" });

    const res = await request(app)
      .post("/api/agent-activity")
      .send({
        taskId: start.body.task.id,
        sessionId: start.body.sessionId,
        activityType: "skill_use",
        title: "Use codex-monitor",
        skillName: "codex-monitor",
        skillPath: "skills/codex-monitor/SKILL.md",
        workItemId: "work-item-1",
        relationType: "implements"
      });

    expect(res.status).toBe(200);
    expect(res.body.events[0].kind).toBe("agent.activity.logged");
  });

  it("bookmark CRUD와 검색을 지원한다", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "Bookmark Search Task" });
    const taskId = start.body.task.id as string;
    const sessionId = start.body.sessionId as string;

    const todo = await request(app)
      .post("/api/todo")
      .send({
        taskId,
        sessionId,
        todoId: "todo-bookmark-1",
        todoState: "added",
        title: "Track bookmarkable todo",
        workItemId: "work-item-bookmark"
      });
    const eventId = todo.body.events[0].id as string;

    const saved = await request(app)
      .post("/api/bookmarks")
      .send({
        taskId,
        eventId,
        title: "Saved todo card",
        note: "Pin this todo"
      });

    expect(saved.status).toBe(200);
    expect(saved.body.bookmark.eventId).toBe(eventId);

    const list = await request(app).get("/api/bookmarks");
    expect(list.status).toBe(200);
    expect(list.body.bookmarks).toHaveLength(1);

    const search = await request(app).get("/api/search").query({ q: "todo" });
    expect(search.status).toBe(200);
    expect(search.body.bookmarks).toHaveLength(1);
    expect(search.body.events.some((event: { eventId: string }) => event.eventId === eventId)).toBe(true);

    const deleted = await request(app).delete(`/api/bookmarks/${saved.body.bookmark.id as string}`);
    expect(deleted.status).toBe(200);
  });
});
