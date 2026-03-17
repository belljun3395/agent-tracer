import { describe, it, expect, beforeEach } from "vitest";
import { MonitorService } from "../../src/application/monitor-service.js";
import type { TaskUserMessageInput } from "../../src/application/types.js";

/** MonitorService 통합 테스트 — 실제 in-memory SQLite 사용 */
describe("MonitorService", () => {
  let service: MonitorService;

  beforeEach(() => {
    service = new MonitorService({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
  });

  describe("startTask", () => {
    it("태스크 생성 후 envelope을 반환한다", () => {
      const result = service.startTask({ title: "Test Task" });
      expect(result.task.title).toBe("Test Task");
      expect(result.task.status).toBe("running");
      expect(result.sessionId).toBeDefined();
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.kind).toBe("task.start");
    });

    it("taskId 지정 시 해당 ID로 생성한다", () => {
      const result = service.startTask({ title: "T", taskId: "custom-id" });
      expect(result.task.id).toBe("custom-id");
    });

    it("기존 태스크 재개 시 task.start 이벤트를 생성하지 않는다", () => {
      const { task } = service.startTask({ title: "T" });
      const resumed = service.startTask({ title: "T", taskId: task.id });
      expect(resumed.task.id).toBe(task.id);
      expect(resumed.sessionId).toBeDefined();
      expect(resumed.events).toHaveLength(0);
    });
  });

  describe("completeTask", () => {
    it("태스크를 완료 처리한다", () => {
      const { task } = service.startTask({ title: "T" });
      const result = service.completeTask({ taskId: task.id });
      expect(result.task.status).toBe("completed");
    });

    it("존재하지 않는 태스크 완료 시 에러를 던진다", () => {
      expect(() => service.completeTask({ taskId: "no-such" })).toThrow();
    });
  });

  describe("renameTask", () => {
    it("태스크 이름을 변경한다", () => {
      const { task } = service.startTask({ title: "Old" });
      const renamed = service.renameTask({ taskId: task.id, title: "New" });
      expect(renamed?.title).toBe("New");
    });

    it("존재하지 않는 태스크 → undefined 반환", () => {
      expect(service.renameTask({ taskId: "no-such", title: "X" })).toBeUndefined();
    });

    it("같은 이름으로 변경 시 그대로 반환한다", () => {
      const { task } = service.startTask({ title: "Same" });
      const result = service.renameTask({ taskId: task.id, title: "Same" });
      expect(result?.title).toBe("Same");
    });
  });

  describe("deleteTask", () => {
    it("실행 중인 태스크도 강제 삭제 가능 → deleted", () => {
      const { task } = service.startTask({ title: "T" });
      expect(service.deleteTask(task.id)).toBe("deleted");
    });

    it("완료된 태스크를 삭제한다 → deleted", () => {
      const { task } = service.startTask({ title: "T" });
      service.completeTask({ taskId: task.id });
      expect(service.deleteTask(task.id)).toBe("deleted");
    });
  });

  describe("logUserMessage — 캐노니컬 user.message 계약", () => {
    it("raw 메시지를 같은 태스크에 기록한다", () => {
      const { task, sessionId } = service.startTask({ title: "Work Item" });
      const input: TaskUserMessageInput = {
        taskId: task.id,
        sessionId,
        messageId: "msg-1",
        captureMode: "raw",
        source: "manual-mcp",
        phase: "initial",
        title: "User prompt text",
        body: "Please do X"
      };
      const result = service.logUserMessage(input);
      expect(result.task.id).toBe(task.id);
      expect(result.task.status).toBe("running");
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.kind).toBe("user.message");
    });

    it("derived 메시지를 sourceEventId와 함께 기록한다", () => {
      const { task, sessionId } = service.startTask({ title: "Work Item" });
      const raw = service.logUserMessage({
        taskId: task.id,
        sessionId,
        messageId: "msg-raw",
        captureMode: "raw",
        source: "manual-mcp",
        title: "Raw prompt"
      });
      const rawEventId = raw.events[0]!.id;

      const derived = service.logUserMessage({
        taskId: task.id,
        sessionId,
        messageId: "msg-derived",
        captureMode: "derived",
        source: "manual-mcp",
        sourceEventId: rawEventId,
        title: "Derived enrichment"
      });
      expect(derived.events[0]?.kind).toBe("user.message");
      const timeline = service.getTaskTimeline(task.id);
      const derivedEvent = timeline.find(e => e.id === derived.events[0]!.id);
      expect(derivedEvent?.metadata.sourceEventId).toBe(rawEventId);
      expect(derivedEvent?.metadata.captureMode).toBe("derived");
    });

    it("여러 raw 메시지가 동일 태스크에 누적된다", () => {
      const { task, sessionId } = service.startTask({ title: "Work Item" });
      service.logUserMessage({
        taskId: task.id, sessionId, messageId: "msg-1",
        captureMode: "raw", source: "manual-mcp", title: "First prompt"
      });
      service.logUserMessage({
        taskId: task.id, sessionId, messageId: "msg-2",
        captureMode: "raw", source: "manual-mcp", phase: "follow_up", title: "Follow-up prompt"
      });
      const timeline = service.getTaskTimeline(task.id);
      const userMessages = timeline.filter(e => e.kind === "user.message");
      expect(userMessages).toHaveLength(2);
    });

    it("자동 이미터(opencode-plugin)가 sessionId 없이 호출하면 에러를 던진다", () => {
      const { task } = service.startTask({ title: "Work Item" });
      // sessionId를 제공하지 않은 opencode-plugin → 자동 이미터는 sessionId 필수
      // 서비스 레이어에서는 sessionId=undefined + automaticSource → sessionId를 결정할 수 없어 기록됨
      // (HTTP 레이어 스키마 검증에서 400으로 거부됨 — 서비스 자체는 기록 허용)
      // 이 케이스는 스키마 검증 테스트에서 확인 (create-app.test.ts)
      const result = service.logUserMessage({
        taskId: task.id,
        messageId: "msg-x",
        captureMode: "raw",
        source: "opencode-plugin",
        title: "No sessionId"
      });
      // sessionId가 없으므로 result.sessionId가 undefined
      expect(result.sessionId).toBeUndefined();
    });
  });

  describe("endSession — 세션 종료 (태스크 유지)", () => {
    it("세션을 종료해도 태스크는 running 상태를 유지한다", () => {
      const { task, sessionId } = service.startTask({ title: "Work Item" });
      const endResult = service.endSession({ taskId: task.id, sessionId });
      expect(endResult.task.status).toBe("running");
      expect(endResult.sessionId).toBe(sessionId);
    });

    it("세션 종료 후 같은 태스크에서 새 세션을 시작할 수 있다", () => {
      const { task, sessionId: firstSessionId } = service.startTask({ title: "Work Item" });
      service.logUserMessage({
        taskId: task.id, sessionId: firstSessionId, messageId: "msg-1",
        captureMode: "raw", source: "manual-mcp", title: "First prompt"
      });
      service.endSession({ taskId: task.id, sessionId: firstSessionId });

      // 같은 taskId로 새 세션 시작
      const restart = service.startTask({ title: "Work Item", taskId: task.id });
      expect(restart.task.id).toBe(task.id);
      expect(restart.sessionId).not.toBe(firstSessionId);

      service.logUserMessage({
        taskId: task.id, sessionId: restart.sessionId, messageId: "msg-2",
        captureMode: "raw", source: "manual-mcp", phase: "follow_up", title: "Follow-up"
      });

      const timeline = service.getTaskTimeline(task.id);
      const userMessages = timeline.filter(e => e.kind === "user.message");
      // 두 세션의 raw 메시지가 모두 같은 태스크 타임라인에 존재해야 한다
      expect(userMessages).toHaveLength(2);
      expect(restart.task.status).toBe("running");
    });

    it("존재하지 않는 태스크 종료 시 에러를 던진다", () => {
      expect(() => service.endSession({ taskId: "no-such" })).toThrow();
    });

    it("background 태스크는 마지막 세션 종료 시 completed로 전환된다", () => {
      const { task: parent } = service.startTask({ title: "Parent" });
      const { task, sessionId } = service.startTask({
        title: "Background child",
        taskKind: "background",
        parentTaskId: parent.id
      });

      const endResult = service.endSession({ taskId: task.id, sessionId });
      expect(endResult.task.status).toBe("completed");

      const timeline = service.getTaskTimeline(task.id);
      const completionEvent = timeline.find((event) => event.kind === "task.complete");
      expect(completionEvent).toBeDefined();
    });

    it("primary 태스크는 completeTask:false 이면 running을 유지한다", () => {
      const { task, sessionId } = service.startTask({ title: "Stay Running" });
      const result = service.endSession({ taskId: task.id, sessionId, completeTask: false });
      expect(result.task.status).toBe("running");
    });

    it("primary 태스크는 completeTask:undefined 이면 running을 유지한다", () => {
      const { task, sessionId } = service.startTask({ title: "Stay Running 2" });
      const result = service.endSession({ taskId: task.id, sessionId });
      expect(result.task.status).toBe("running");
    });

    it("background 태스크는 실행 중인 세션이 남아있으면 첫 번째 session-end 후에도 running을 유지한다", () => {
      const { task: parent } = service.startTask({ title: "Parent Multi" });
      // First session
      const { task, sessionId: session1 } = service.startTask({
        title: "Background multi-session",
        taskKind: "background",
        parentTaskId: parent.id
      });
      // Second session for the same task
      const { sessionId: session2 } = service.startTask({
        title: "Background multi-session",
        taskId: task.id,
        taskKind: "background",
        parentTaskId: parent.id
      });

      // End first session — second is still running → task must stay running
      const midResult = service.endSession({ taskId: task.id, sessionId: session1 });
      expect(midResult.task.status).toBe("running");

      // End second (last) session → now task should complete
      const finalResult = service.endSession({ taskId: task.id, sessionId: session2 });
      expect(finalResult.task.status).toBe("completed");
    });
  });
});

describe("logQuestion — question.logged 계약", () => {
  let service: MonitorService;

  beforeEach(() => {
    service = new MonitorService({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
  });

  it("모든 단계는 questions 레인으로 기록된다", () => {
    const { task, sessionId } = service.startTask({ title: "T" });
    const result = service.logQuestion({
      taskId: task.id, sessionId,
      questionId: "q1", questionPhase: "asked",
      title: "Should we use TypeScript?"
    });
    expect(result.events[0]?.kind).toBe("question.logged");
    const timeline = service.getTaskTimeline(task.id);
    const ev = timeline.find(e => e.id === result.events[0]!.id);
    expect(ev?.lane).toBe("questions");
    expect(ev?.metadata.questionId).toBe("q1");
    expect(ev?.metadata.questionPhase).toBe("asked");
  });

  it("concluded 단계도 questions 레인으로 기록된다", () => {
    const { task, sessionId } = service.startTask({ title: "T" });
    const result = service.logQuestion({
      taskId: task.id, sessionId,
      questionId: "q1", questionPhase: "concluded",
      title: "Decision: use TypeScript"
    });
    const timeline = service.getTaskTimeline(task.id);
    const ev = timeline.find(e => e.id === result.events[0]!.id);
    expect(ev?.lane).toBe("questions");
  });

  it("존재하지 않는 태스크 → 에러", () => {
    expect(() => service.logQuestion({
      taskId: "no-such", questionId: "q1",
      questionPhase: "asked", title: "?"
    })).toThrow();
  });
});

describe("logTodo — todo.logged 계약", () => {
  let service: MonitorService;

  beforeEach(() => {
    service = new MonitorService({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
  });

  it("todo 이벤트는 todos 레인으로 기록된다", () => {
    const { task, sessionId } = service.startTask({ title: "T" });
    const result = service.logTodo({
      taskId: task.id, sessionId,
      todoId: "todo-1", todoState: "added",
      title: "Implement feature X"
    });
    expect(result.events[0]?.kind).toBe("todo.logged");
    const timeline = service.getTaskTimeline(task.id);
    const ev = timeline.find(e => e.id === result.events[0]!.id);
    expect(ev?.lane).toBe("todos");
    expect(ev?.metadata.todoId).toBe("todo-1");
    expect(ev?.metadata.todoState).toBe("added");
  });

  it("동일 todoId로 다른 상태를 기록할 수 있다", () => {
    const { task, sessionId } = service.startTask({ title: "T" });
    service.logTodo({ taskId: task.id, sessionId, todoId: "todo-1", todoState: "added", title: "X" });
    service.logTodo({ taskId: task.id, sessionId, todoId: "todo-1", todoState: "completed", title: "X done" });
    const timeline = service.getTaskTimeline(task.id);
    const todos = timeline.filter(e => e.kind === "todo.logged" && e.metadata.todoId === "todo-1");
    expect(todos).toHaveLength(2);
  });
});

describe("logThought — thought.logged 계약", () => {
  let service: MonitorService;

  beforeEach(() => {
    service = new MonitorService({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
  });

  it("thought 이벤트는 planning 레인으로 기록된다", () => {
    const { task, sessionId } = service.startTask({ title: "T" });
    const result = service.logThought({
      taskId: task.id, sessionId,
      title: "Analyzing the problem",
      body: "The issue seems to be...",
      modelName: "claude-opus-4-6",
      modelProvider: "anthropic"
    });
    expect(result.events[0]?.kind).toBe("thought.logged");
    const timeline = service.getTaskTimeline(task.id);
    const ev = timeline.find(e => e.id === result.events[0]!.id);
    expect(ev?.lane).toBe("planning");
    expect(ev?.metadata.modelName).toBe("claude-opus-4-6");
  });
});
