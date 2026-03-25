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

  it("task-start가 generic runtimeSource를 task read-model에 저장한다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({
        title: "Codex - agent-tracer",
        runtimeSource: "codex-skill"
      });

    const taskId = started.body.task.id as string;
    const list = await request(runtime.app).get("/api/tasks");
    const task = (list.body.tasks as Array<{ id: string; runtimeSource?: string }>)
      .find((item) => item.id === taskId);

    expect(started.status).toBe(200);
    expect(task?.runtimeSource).toBe("codex-skill");
  });

  it("이벤트 displayTitle override를 저장하고 reset할 수 있다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({ title: "이벤트 제목 편집" });

    const taskId = started.body.task.id as string;
    const sessionId = started.body.sessionId as string;

    const message = await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId,
        messageId: "msg-editable-title",
        captureMode: "raw",
        source: "manual-mcp",
        title: "[CONTEXT]: User requested to inspect the README and revert a temporary comment.",
        body: "원본 제목은 유지하고 inspector용 제목만 바꾼다."
      });

    const eventId = message.body.events[0].id as string;

    const patched = await request(runtime.app)
      .patch(`/api/events/${eventId}`)
      .send({ displayTitle: "README check and revert" });

    expect(patched.status).toBe(200);
    expect(patched.body.event.title).toBe("[CONTEXT]: User requested to inspect the README and revert a temporary comment.");
    expect(patched.body.event.metadata.displayTitle).toBe("README check and revert");

    const reset = await request(runtime.app)
      .patch(`/api/events/${eventId}`)
      .send({ displayTitle: null });

    expect(reset.status).toBe(200);
    expect(reset.body.event.title).toBe("[CONTEXT]: User requested to inspect the README and revert a temporary comment.");
    expect(reset.body.event.metadata.displayTitle).toBeUndefined();
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

    const list = await request(runtime.app).get("/api/tasks");
    const task = (list.body.tasks as Array<{ id: string; runtimeSource?: string }>)
      .find((item) => item.id === first.body.taskId);

    expect(task?.runtimeSource).toBe("claude-hook");
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

  it("Codex runtime 세션은 같은 thread id에서 task를 재사용하고 assistant.response를 남긴다", async () => {
    const runtimeSessionId = "codex-thread-1";

    const first = await request(runtime.app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "codex-skill",
        runtimeSessionId,
        title: "Codex - agent-tracer",
        workspacePath: "/workspace/agent-tracer"
      });

    expect(first.status).toBe(200);

    const taskId = first.body.taskId as string;
    const firstSessionId = first.body.sessionId as string;

    await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId: firstSessionId,
        messageId: "codex-user-1",
        captureMode: "raw",
        source: "manual-mcp",
        phase: "initial",
        title: "첫 요청",
        body: "Codex task reuse를 고쳐줘"
      });

    await request(runtime.app)
      .post("/api/assistant-response")
      .send({
        taskId,
        sessionId: firstSessionId,
        messageId: "codex-assistant-1",
        source: "codex-skill",
        title: "I'll investigate the Codex task reuse flow.",
        body: "I'll investigate the Codex task reuse flow and keep the same task across turns."
      });

    const firstEnded = await request(runtime.app)
      .post("/api/runtime-session-end")
      .send({
        runtimeSource: "codex-skill",
        runtimeSessionId,
        completionReason: "idle",
        summary: "Codex turn idle"
      });

    expect(firstEnded.status).toBe(200);

    const waitingDetail = await request(runtime.app).get(`/api/tasks/${taskId}`);
    expect(waitingDetail.status).toBe(200);
    expect(waitingDetail.body.task.status).toBe("waiting");

    const reopened = await request(runtime.app)
      .post("/api/runtime-session-ensure")
      .send({
        runtimeSource: "codex-skill",
        runtimeSessionId,
        title: "Codex - agent-tracer",
        workspacePath: "/workspace/agent-tracer"
      });

    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({
      taskId,
      taskCreated: false,
      sessionCreated: true
    });
    expect(reopened.body.sessionId).not.toBe(firstSessionId);

    const secondSessionId = reopened.body.sessionId as string;

    await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId: secondSessionId,
        messageId: "codex-user-2",
        captureMode: "raw",
        source: "manual-mcp",
        phase: "follow_up",
        title: "후속 요청",
        body: "assistant.response도 같이 기록해줘"
      });

    await request(runtime.app)
      .post("/api/assistant-response")
      .send({
        taskId,
        sessionId: secondSessionId,
        messageId: "codex-assistant-2",
        source: "codex-skill",
        title: "I'll record assistant responses too.",
        body: "I'll record assistant responses too and keep reusing the same runtime session binding."
      });

    const detail = await request(runtime.app).get(`/api/tasks/${taskId}`);
    const timeline = detail.body.timeline as Array<{ kind: string; sessionId?: string; title: string }>;

    expect(detail.status).toBe(200);
    expect(detail.body.task.status).toBe("running");
    expect(timeline.filter((event) => event.kind === "user.message")).toHaveLength(2);
    expect(timeline.filter((event) => event.kind === "assistant.response")).toHaveLength(2);

    const responseSessionIds = new Set(
      timeline
        .filter((event) => event.kind === "assistant.response")
        .map((event) => event.sessionId)
    );

    expect(responseSessionIds).toEqual(new Set([firstSessionId, secondSessionId]));
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

  it("검색은 대소문자를 구분하지 않는다", async () => {
    const started = await request(runtime.app)
      .post("/api/task-start")
      .send({ title: "CamelCase Task Title" });

    const taskId = started.body.task.id as string;
    const sessionId = started.body.sessionId as string;

    await request(runtime.app)
      .post("/api/user-message")
      .send({
        taskId,
        sessionId,
        messageId: "msg-case",
        captureMode: "raw",
        source: "manual-mcp",
        title: "CamelCase Event Title",
        body: "CamelCase body content"
      });

    const lowerSearch = await request(runtime.app).get("/api/search?q=camelcase");
    const upperSearch = await request(runtime.app).get("/api/search?q=CAMELCASE");
    const mixedSearch = await request(runtime.app).get("/api/search?q=CamelCase");

    expect(lowerSearch.body.tasks.some((t: { taskId: string }) => t.taskId === taskId)).toBe(true);
    expect(upperSearch.body.tasks.some((t: { taskId: string }) => t.taskId === taskId)).toBe(true);
    expect(mixedSearch.body.tasks.some((t: { taskId: string }) => t.taskId === taskId)).toBe(true);

    expect(lowerSearch.body.events.some((e: { taskId: string }) => e.taskId === taskId)).toBe(true);
    expect(upperSearch.body.events.some((e: { taskId: string }) => e.taskId === taskId)).toBe(true);
    expect(mixedSearch.body.events.some((e: { taskId: string }) => e.taskId === taskId)).toBe(true);
  });
});
