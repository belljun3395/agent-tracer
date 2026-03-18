import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createRuntimeHarness } from "../test-helpers.js";

describe("HTTP API", () => {
  let runtime: ReturnType<typeof createRuntimeHarness>;

  beforeEach(() => {
    runtime = createRuntimeHarness();
  });

  afterEach(() => {
    runtime.close();
  });

  it("상태 확인 엔드포인트를 제공한다", async () => {
    const response = await request(runtime.app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("generic 작업 제목보다 실제 사용자 목표를 displayTitle로 보여준다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({
        title: "Codex - agent-tracer",
        workspacePath: "/Users/okestro/Documents/code/agent-tracer"
      });

    const taskId = started.body.task.id as string;
    const sessionId = started.body.sessionId as string;
    const goal = "실제 사용자 요청을 제목처럼 보이게 정리한다.";

    await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId,
        messageId: "msg-display-title",
        captureMode: "raw",
        source: "manual-mcp",
        title: "사용자 요청",
        body: goal
      });

    const list = await request(runtime.app).get("/api/tasks");
    const task = (list.body.tasks as Array<{ id: string; displayTitle?: string }>)
      .find((item) => item.id === taskId);

    expect(list.status).toBe(200);
    expect(task?.displayTitle).toBe(goal);
  });

  it("derived 사용자 메시지에 sourceEventId가 없으면 400을 반환한다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({ title: "파생 메시지 검증" });

    const response = await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId: started.body.task.id,
        sessionId: started.body.sessionId,
        messageId: "msg-derived",
        captureMode: "derived",
        source: "manual-mcp",
        title: "파생 메시지"
      });

    expect(response.status).toBe(400);
  });

  it("사용자 메시지에 sessionId가 없으면 400을 반환한다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({ title: "세션 필수 검증" });

    const response = await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId: started.body.task.id,
        messageId: "msg-no-session",
        captureMode: "raw",
        source: "manual-mcp",
        title: "세션 없는 요청"
      });

    expect(response.status).toBe(400);
  });

  it("같은 runtime 세션 보장은 중복 task와 session을 만들지 않는다", async () => {
    const first = await request(runtime.app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "claude-hook",
        runtimeSessionId: "runtime-1",
        title: "Claude - agent-tracer",
        workspacePath: "/workspace/agent-tracer"
      });

    const second = await request(runtime.app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "claude-hook",
        runtimeSessionId: "runtime-1",
        title: "Claude - agent-tracer",
        workspacePath: "/workspace/agent-tracer"
      });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      taskId: first.body.taskId,
      sessionId: first.body.sessionId,
      taskCreated: false,
      sessionCreated: false
    });
  });

  it("idle runtime 세션 종료 뒤 다시 보장하면 같은 task를 새 session으로 재개한다", async () => {
    const first = await request(runtime.app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "claude-hook",
        runtimeSessionId: "runtime-2",
        title: "Claude - agent-tracer",
        workspacePath: "/workspace/agent-tracer"
      });

    const ended = await request(runtime.app)
      .post("/api/runtime-session-end")
      .send({
        runtimeSource: "claude-hook",
        runtimeSessionId: "runtime-2",
        completionReason: "idle"
      });

    const reopened = await request(runtime.app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "claude-hook",
        runtimeSessionId: "runtime-2",
        title: "Claude - agent-tracer",
        workspacePath: "/workspace/agent-tracer"
      });

    expect(ended.status).toBe(200);
    expect(reopened.body).toMatchObject({
      taskId: first.body.taskId,
      taskCreated: false,
      sessionCreated: true
    });
    expect(reopened.body.sessionId).not.toBe(first.body.sessionId);
  });

  it("북마크와 검색이 같은 작업 맥락을 다시 찾게 해준다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({ title: "검색 대상 작업" });

    const taskId = started.body.task.id as string;
    const sessionId = started.body.sessionId as string;

    const message = await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId,
        messageId: "msg-search",
        captureMode: "raw",
        source: "manual-mcp",
        title: "검색 요청",
        body: "북마크와 검색 결과가 같은 작업을 가리켜야 한다"
      });

    const bookmark = await request(runtime.app)
      .post("/api/bookmarks")
      .send({
        taskId,
        eventId: message.body.events[0].id,
        title: "검색 북마크"
      });

    const bookmarks = await request(runtime.app).get(`/api/bookmarks?taskId=${taskId}`);
    const search = await request(runtime.app).get("/api/search?q=검색");

    expect(bookmark.status).toBe(200);
    expect(bookmarks.body.bookmarks).toEqual([
      expect.objectContaining({
        taskId,
        eventId: message.body.events[0].id,
        title: "검색 북마크"
      })
    ]);
    expect(search.body.tasks.some((item: { taskId: string }) => item.taskId === taskId)).toBe(true);
    expect(search.body.events.some((item: { eventId: string }) => item.eventId === message.body.events[0].id)).toBe(true);
    expect(search.body.bookmarks.some((item: { bookmarkId: string }) => item.bookmarkId === bookmark.body.bookmark.id)).toBe(true);
  });
});
