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

    it("derived 페이로드에 sourceEventId 누락 → 200 (서버가 추론하지 않음)", async () => {
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
          // sourceEventId 누락 — 스키마 레벨 검증 없음, 서비스 레이어에서 기록됨
        });
      expect(res.status).toBe(200);
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
