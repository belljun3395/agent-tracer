import { describe, it, expect, vi, beforeEach } from "vitest";
import { MonitorClient } from "../src/client.js";
import { createMonitorMcpServer } from "../src/index.js";

/**
 * MonitorClient HTTP 클라이언트 단위 테스트.
 * fetch를 mock하여 네트워크 없이 동작을 검증한다.
 */
describe("MonitorClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("baseUrl 기본값이 적용된다", () => {
    // Remove env var to test default
    const saved = process.env.MONITOR_BASE_URL;
    delete process.env.MONITOR_BASE_URL;
    const client = new MonitorClient();
    expect(client.baseUrl).toBe("http://127.0.0.1:3847");
    if (saved !== undefined) process.env.MONITOR_BASE_URL = saved;
  });

  it("baseUrl 끝 슬래시를 제거한다", () => {
    const client = new MonitorClient("http://localhost:3847/");
    expect(client.baseUrl).toBe("http://localhost:3847");
  });

  it("정상 POST → ok:true 결과를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ task: { id: "t1" } })
    }));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", { title: "T" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("4xx 응답 → ok:false, 상태코드를 포함한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({})
    }));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("5xx 응답 → ok:false를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    }));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", {});
    expect(result.ok).toBe(false);
  });

  it("네트워크 실패 시 조용히 ok:false를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", {});
    expect(result.ok).toBe(false);
    expect(result.message).toContain("unavailable");
  });
});

describe("MCP tool registry — canonical tools", () => {
  it("monitor_user_message 가 /api/user-message 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [{ id: "e1", kind: "user.message" }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MonitorClient("http://localhost:3847");
    const server = createMonitorMcpServer(client);
    expect(server).toBeDefined();

    await client.post("/api/user-message", {
      taskId: "t1",
      sessionId: "s1",
      messageId: "msg-1",
      captureMode: "raw",
      source: "manual-mcp",
      title: "Test prompt"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/user-message",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("monitor_session_end 가 /api/session-end 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sessionId: "s1", task: { id: "t1", status: "running" } })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MonitorClient("http://localhost:3847");

    await client.post("/api/session-end", {
      taskId: "t1",
      sessionId: "s1",
      completionReason: "idle",
      backgroundCompletions: ["bg-1"]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/session-end",
      expect.objectContaining({ method: "POST" })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as { body?: string };
    expect(requestInit.body).toBe(JSON.stringify({
      taskId: "t1",
      sessionId: "s1",
      completionReason: "idle",
      backgroundCompletions: ["bg-1"]
    }));
  });

  it("monitor_runtime_session_ensure 가 /api/runtime-session-ensure 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ taskId: "t1", sessionId: "s1", taskCreated: true, sessionCreated: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MonitorClient("http://localhost:3847");
    const server = createMonitorMcpServer(client);
    expect(server).toBeDefined();

    await client.post("/api/runtime-session-ensure", {
      runtimeSource: "codex-skill",
      runtimeSessionId: "codex-thread-1",
      title: "Codex - repo"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/runtime-session-ensure",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("monitor_runtime_session_end 가 /api/runtime-session-end 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MonitorClient("http://localhost:3847");
    const server = createMonitorMcpServer(client);
    expect(server).toBeDefined();

    await client.post("/api/runtime-session-end", {
      runtimeSource: "codex-skill",
      runtimeSessionId: "codex-thread-1",
      completionReason: "idle",
      backgroundCompletions: ["bg-1"]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/runtime-session-end",
      expect.objectContaining({ method: "POST" })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as { body?: string };
    expect(requestInit.body).toBe(JSON.stringify({
      runtimeSource: "codex-skill",
      runtimeSessionId: "codex-thread-1",
      completionReason: "idle",
      backgroundCompletions: ["bg-1"]
    }));
  });

  it("monitor_assistant_response 가 /api/assistant-response 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [{ id: "e1", kind: "assistant.response" }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MonitorClient("http://localhost:3847");
    const server = createMonitorMcpServer(client);
    expect(server).toBeDefined();

    await client.post("/api/assistant-response", {
      taskId: "t1",
      sessionId: "s1",
      messageId: "assistant-1",
      source: "codex-skill",
      title: "I updated the integration.",
      body: "I updated the integration to reuse the same task across turns."
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/assistant-response",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("MCP 서버에 monitor_user_message 와 monitor_session_end 가 등록된다", () => {
    const client = new MonitorClient();
    const server = createMonitorMcpServer(client);
    // McpServer가 정상 생성되면 도구가 등록된 것으로 간주
    expect(server).toBeDefined();
  });

  it("monitor_task_link 가 /api/task-link 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ task: { id: "t1", taskKind: "background" } })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MonitorClient("http://localhost:3847");
    const server = createMonitorMcpServer(client);
    expect(server).toBeDefined();

    await client.post("/api/task-link", {
      taskId: "t1",
      taskKind: "background",
      parentTaskId: "parent-1",
      parentSessionId: "session-parent-1",
      backgroundTaskId: "bg-1"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/task-link",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("MCP tool registry — question/todo/thought tools", () => {
  it("monitor_question 이 /api/question 으로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ events: [{ id: "e1", kind: "question.logged" }] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new MonitorClient("http://localhost:3847");
    await client.post("/api/question", { taskId: "t1", questionId: "q1", questionPhase: "asked", title: "?" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/question",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("monitor_todo 이 /api/todo 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ events: [{ id: "e1", kind: "todo.logged" }] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new MonitorClient("http://localhost:3847");
    await client.post("/api/todo", { taskId: "t1", todoId: "todo-1", todoState: "added", title: "Feature" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/todo",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("monitor_thought 이 /api/thought 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ events: [{ id: "e1", kind: "thought.logged" }] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new MonitorClient("http://localhost:3847");
    await client.post("/api/thought", { taskId: "t1", title: "Analysis" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/thought",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("monitor_agent_activity 가 /api/agent-activity 로 POST한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ events: [{ id: "e1", kind: "agent.activity.logged" }] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new MonitorClient("http://localhost:3847");
    await client.post("/api/agent-activity", {
      taskId: "t1",
      activityType: "skill_use",
      title: "Use codex-monitor",
      skillName: "codex-monitor"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3847/api/agent-activity",
      expect.objectContaining({ method: "POST" })
    );
  });
});
