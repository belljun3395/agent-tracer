import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createServiceHarness } from "../test-helpers.js";

describe("MonitorService", () => {
  let harness: ReturnType<typeof createServiceHarness>;

  beforeEach(() => {
    harness = createServiceHarness();
  });

  afterEach(() => {
    harness.close();
  });

  it("작업을 시작하면 세션과 task.start 이벤트를 함께 만든다", async () => {
    const result = await harness.service.startTask({
      title: "Codex - agent-tracer",
      workspacePath: "/tmp//agent-tracer///"
    });

    expect(result.task).toMatchObject({
      title: "Codex - agent-tracer",
      status: "running",
      workspacePath: "/tmp/agent-tracer"
    });
    expect(result.sessionId).toBeTruthy();
    expect(result.events).toEqual([
      expect.objectContaining({ kind: "task.start" })
    ]);

    const timeline = await harness.service.getTaskTimeline(result.task.id);
    expect(timeline.map((event) => event.kind)).toEqual(["task.start"]);
  });

  it("raw 메시지와 derived 메시지를 같은 작업 흐름에 연결한다", async () => {
    const started = await harness.service.startTask({ title: "사용자 요청 추적" });

    const raw = await harness.service.logUserMessage({
      taskId: started.task.id,
      sessionId: started.sessionId!,
      messageId: "msg-1",
      captureMode: "raw",
      source: "manual-mcp",
      title: "원본 요청",
      body: "테스트 구조를 정리해줘"
    });

    const derived = await harness.service.logUserMessage({
      taskId: started.task.id,
      sessionId: started.sessionId!,
      messageId: "msg-2",
      captureMode: "derived",
      source: "manual-mcp",
      sourceEventId: raw.events[0]!.id,
      title: "요청 요약",
      body: "테스트를 비즈니스 규칙 중심으로 재정리"
    });

    const timeline = await harness.service.getTaskTimeline(started.task.id);
    const userMessages = timeline.filter((event) => event.kind === "user.message");

    expect(userMessages).toHaveLength(2);
    expect(userMessages[0]?.metadata.captureMode).toBe("raw");
    expect(userMessages[1]?.metadata).toMatchObject({
      captureMode: "derived",
      sourceEventId: raw.events[0]!.id
    });
    expect(derived.events[0]?.kind).toBe("user.message");
  });

  it("background 자식이 남아 있으면 primary 작업을 바로 완료하지 않고 waiting으로 둔다", async () => {
    const parent = await harness.service.startTask({ title: "상위 작업" });
    await harness.service.startTask({
      title: "백그라운드 자식",
      taskKind: "background",
      parentTaskId: parent.task.id,
      parentSessionId: parent.sessionId!
    });

    const ended = await harness.service.endSession({
      taskId: parent.task.id,
      sessionId: parent.sessionId!,
      completeTask: true,
      completionReason: "assistant_turn_complete"
    });

    expect(ended.task.status).toBe("waiting");
  });

  it("background 작업의 마지막 세션이 끝나면 자동으로 completed가 된다", async () => {
    const background = await harness.service.startTask({
      title: "백그라운드 작업",
      taskKind: "background"
    });

    const ended = await harness.service.endSession({
      taskId: background.task.id,
      sessionId: background.sessionId!
    });

    expect(ended.task.status).toBe("completed");

    const timeline = await harness.service.getTaskTimeline(background.task.id);
    expect(timeline.some((event) => event.kind === "task.complete")).toBe(true);
  });

  it("idle로 종료된 runtime 세션은 같은 task로 다시 이어서 재개한다", async () => {
    const first = await harness.service.ensureRuntimeSession({
      runtimeSource: "claude-hook",
      runtimeSessionId: "runtime-1",
      title: "Claude - agent-tracer",
      workspacePath: "/workspace/agent-tracer"
    });

    await harness.service.endRuntimeSession({
      runtimeSource: "claude-hook",
      runtimeSessionId: "runtime-1",
      completionReason: "idle"
    });

    const waitingTask = await harness.service.getTask(first.taskId);
    expect(waitingTask?.status).toBe("waiting");

    const reopened = await harness.service.ensureRuntimeSession({
      runtimeSource: "claude-hook",
      runtimeSessionId: "runtime-1",
      title: "Claude - agent-tracer",
      workspacePath: "/workspace/agent-tracer"
    });

    expect(reopened).toMatchObject({
      taskId: first.taskId,
      taskCreated: false,
      sessionCreated: true
    });
    expect(reopened.sessionId).not.toBe(first.sessionId);

    const resumedTask = await harness.service.getTask(first.taskId);
    expect(resumedTask?.status).toBe("running");
  });
});
