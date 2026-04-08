/**
 * @module presentation/ws/cli-ws-handler.test
 *
 * Unit tests for CliWsHandler focusing on:
 *  - workdir validation (F-1 / F-6)
 *  - cancel/complete race guard (F-4)
 *  - field-presence guards (F-6)
 */

import { EventEmitter } from "node:events";
import { describe, it, expect, vi } from "vitest";

import { CliWsHandler } from "./cli-ws-handler.js";
import type { CliBridgeService } from "../../application/cli-bridge/cli-bridge-service.js";
import type { CliProcess } from "../../application/cli-bridge/types.js";
import { PassThrough } from "node:stream";

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

function makeMockWs() {
  const sent: string[] = [];
  const emitter = new EventEmitter();
  const ws = {
    readyState: 1,
    send: vi.fn((data: string) => sent.push(data)),
    on: (event: string, handler: (...args: unknown[]) => void) => emitter.on(event, handler),
    emit: emitter.emit.bind(emitter),
    _sent: sent,
  };
  return ws;
}

function makeMockProcess(processId = "proc-1"): CliProcess & { _stdout: PassThrough; _resolveWait: (code: number) => void } {
  const stdout = new PassThrough();
  let resolveWait!: (code: number) => void;
  const waitPromise = new Promise<number>((res) => { resolveWait = res; });
  return {
    processId,
    sessionId: "sess-1",
    cli: "claude",
    stdout,
    sendMessage: vi.fn(),
    kill: vi.fn(),
    wait: () => waitPromise,
    _stdout: stdout,
    _resolveWait: resolveWait,
  };
}

function makeMockBridgeService(mockProcess?: ReturnType<typeof makeMockProcess>) {
  const activeProcesses = new Map<string, CliProcess>();
  if (mockProcess) activeProcesses.set(mockProcess.processId, mockProcess);

  return {
    startChat: vi.fn(async () => {
      if (!mockProcess) throw new Error("no mock process");
      activeProcesses.set(mockProcess.processId, mockProcess);
      return mockProcess;
    }),
    resumeChat: vi.fn(async () => {
      if (!mockProcess) throw new Error("no mock process");
      activeProcesses.set(mockProcess.processId, mockProcess);
      return mockProcess;
    }),
    getProcess: vi.fn((id: string) => activeProcesses.get(id)),
    cancelChat: vi.fn((id: string) => {
      const had = activeProcesses.has(id);
      activeProcesses.delete(id);
      return had;
    }),
    removeProcess: vi.fn((id: string) => { activeProcesses.delete(id); }),
  } as unknown as CliBridgeService;
}

function attachAndConnect(handler: CliWsHandler, ws: ReturnType<typeof makeMockWs>) {
  const wss = new EventEmitter() as Parameters<CliWsHandler["attach"]>[0];
  handler.attach(wss);
  wss.emit("connection", ws);
}

function sendWsMessage(ws: ReturnType<typeof makeMockWs>, payload: unknown) {
  ws.emit("message", JSON.stringify(payload));
}

function makeMockMonitorService(taskStatus?: "running" | "waiting" | "completed" | "errored") {
  return {
    getTask: vi.fn(async (_taskId: string) => taskStatus ? ({
      id: "task-1",
      title: "Guarded task",
      slug: "guarded-task",
      status: taskStatus,
      taskKind: "primary",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }) : null),
    startTask: vi.fn(async (input: { taskId?: string }) => ({
      task: { id: input.taskId ?? "task-1" }
    }))
  };
}

// ---------------------------------------------------------------------------
// Workdir validation (F-1 / F-6)
// ---------------------------------------------------------------------------

describe("CliWsHandler — workdir validation", () => {
  it("rejects empty workdir with cli:error", async () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "", prompt: "hello" });
    await Promise.resolve(); // flush microtasks

    expect(bridge.startChat).not.toHaveBeenCalled();
    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
    expect(errorMsg).toMatch(/workdir/);
  });

  it("rejects relative workdir with cli:error", async () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "relative/path", prompt: "hello" });
    await Promise.resolve();

    expect(bridge.startChat).not.toHaveBeenCalled();
    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
    expect(errorMsg).toMatch(/absolute/);
  });

  it("rejects non-existent absolute workdir with cli:error", async () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "/this/path/definitely/does/not/exist/xyz", prompt: "hello" });
    await Promise.resolve();

    expect(bridge.startChat).not.toHaveBeenCalled();
    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
    expect(errorMsg).toMatch(/does not exist/);
  });

  it("accepts valid absolute workdir that exists", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "/tmp", prompt: "hello" });
    await new Promise((r) => setTimeout(r, 0));

    expect(bridge.startChat).toHaveBeenCalledWith(
      expect.objectContaining({ workdir: "/tmp", prompt: "hello" })
    );
  });
});

// ---------------------------------------------------------------------------
// Field-presence guards (F-6)
// ---------------------------------------------------------------------------

describe("CliWsHandler — field guards", () => {
  it("rejects cli:start with empty prompt", async () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "/tmp", prompt: "" });
    await Promise.resolve();

    expect(bridge.startChat).not.toHaveBeenCalled();
    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toMatch(/prompt/);
  });

  it("rejects cli:message with empty message text", () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:message", processId: mockProcess.processId, message: "" });

    expect(mockProcess.sendMessage).not.toHaveBeenCalled();
    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
  });

  it("rejects cli:cancel without processId", () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:cancel", processId: "" });

    expect(bridge.cancelChat).not.toHaveBeenCalled();
    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
  });

  it("rejects unknown message type", () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "unknown:whatever" });

    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
  });

  it("rejects malformed JSON gracefully", () => {
    const bridge = makeMockBridgeService();
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    ws.emit("message", "{{not valid json}}");

    const errorMsg = ws._sent.find((s) => s.includes("cli:error"));
    expect(errorMsg).toBeDefined();
  });
});

describe("CliWsHandler — rule guard gating", () => {
  it("rejects cli:start when the linked task is waiting for approval", async () => {
    const bridge = makeMockBridgeService();
    const monitorService = makeMockMonitorService("waiting");
    const handler = new CliWsHandler(bridge, monitorService as never);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:start",
      cli: "claude",
      workdir: "/tmp",
      prompt: "hello",
      taskId: "task-1"
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(bridge.startChat).not.toHaveBeenCalled();
    expect(ws._sent.some((s) => s.includes("waiting for approval"))).toBe(true);
  });

  it("rejects cli:message when the linked task becomes blocked", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const getTask = vi.fn()
      .mockResolvedValueOnce({
        id: "task-1",
        title: "Guarded task",
        slug: "guarded-task",
        status: "running",
        taskKind: "primary",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .mockResolvedValue({
        id: "task-1",
        title: "Guarded task",
        slug: "guarded-task",
        status: "errored",
        taskKind: "primary",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    const monitorService = {
      getTask,
      startTask: vi.fn(async (input: { taskId?: string }) => ({ task: { id: input.taskId ?? "task-1" } }))
    };
    const handler = new CliWsHandler(bridge, monitorService as never);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:resume",
      cli: "claude",
      sessionId: "sess-1",
      workdir: "/tmp",
      prompt: "resume",
      taskId: "task-1"
    });
    await new Promise((r) => setTimeout(r, 10));

    sendWsMessage(ws, { type: "cli:message", processId: mockProcess.processId, message: "next" });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockProcess.sendMessage).not.toHaveBeenCalled();
    expect(ws._sent.some((s) => s.includes("blocked by a rule"))).toBe(true);
  });
});

describe("CliWsHandler — interrupt task", () => {
  it("cancels an active process by taskId", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:start",
      cli: "claude",
      workdir: "/tmp",
      prompt: "hello",
      taskId: "task-interrupt"
    });
    await new Promise((r) => setTimeout(r, 0));

    sendWsMessage(ws, { type: "cli:interrupt-task", taskId: "task-interrupt" });

    expect(bridge.cancelChat).toHaveBeenCalledWith(mockProcess.processId);
  });
});

// ---------------------------------------------------------------------------
// Cancel / complete race guard (F-4)
// ---------------------------------------------------------------------------

describe("CliWsHandler — cancel/complete race", () => {
  it("does not send cli:complete for a cancelled process", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    // Start a chat so the process is tracked
    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "/tmp", prompt: "hello" });
    await Promise.resolve(); // let handleStart run

    // Cancel the process
    sendWsMessage(ws, { type: "cli:cancel", processId: mockProcess.processId });

    // Simulate the process exiting after cancel
    mockProcess._resolveWait(0);
    await Promise.resolve();
    await Promise.resolve();

    // cli:complete must NOT be in sent messages
    const completeMsg = ws._sent.find((s) => s.includes("cli:complete"));
    expect(completeMsg).toBeUndefined();
  });

  it("sends cli:complete for a process that exits normally (not cancelled)", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "/tmp", prompt: "hello" });
    await new Promise((r) => setTimeout(r, 0));

    // Process exits without cancel
    mockProcess._resolveWait(0);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const completeMsg = ws._sent.find((s) => s.includes("cli:complete"));
    expect(completeMsg).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// OpenCode canonical taskId propagation (Codex high finding)
// ---------------------------------------------------------------------------

function makeMockCanonicalMonitorService(canonicalTaskId?: string) {
  return {
    getTask: vi.fn(async () => ({
      id: canonicalTaskId ?? "server-assigned-task-id",
      title: "Canonical task",
      slug: "canonical-task",
      status: "running",
      taskKind: "primary",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })),
    startTask: vi.fn(async (input: { taskId?: string }) => ({
      task: { id: canonicalTaskId ?? input.taskId ?? "server-assigned-task-id" },
      sessionId: "monitor-sess-1",
    })),
  } as unknown as import("../../application/monitor-service.js").MonitorService;
}

describe("CliWsHandler — OpenCode canonical taskId propagation", () => {
  it("resolves canonical taskId from monitorService and includes it in cli:started when no taskId given", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const monitorService = makeMockCanonicalMonitorService("server-assigned-task-id");
    const handler = new CliWsHandler(bridge, monitorService);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "opencode", workdir: "/tmp", prompt: "hello" });
    // registerOpencodeTask is async — flush microtasks
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBe("server-assigned-task-id");
  });

  it("passes canonical taskId to bridgeService.startChat for OpenCode", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const monitorService = makeMockCanonicalMonitorService("server-assigned-task-id");
    const handler = new CliWsHandler(bridge, monitorService);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "opencode", workdir: "/tmp", prompt: "hello" });
    await new Promise((r) => setTimeout(r, 0));

    expect(bridge.startChat).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "server-assigned-task-id" })
    );
  });

  it("uses client-supplied taskId as hint but reflects canonical server taskId in cli:started", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    // Server confirms the supplied taskId is canonical (upsert found existing task)
    const monitorService = makeMockCanonicalMonitorService("task-hint-confirmed");
    const handler = new CliWsHandler(bridge, monitorService);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:start", cli: "opencode", workdir: "/tmp", prompt: "hello", taskId: "task-hint"
    });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    const started = JSON.parse(startedRaw!);
    // The server-returned canonical ID takes precedence
    expect(started.taskId).toBe("task-hint-confirmed");
  });

  it("includes canonical taskId in cli:started for OpenCode cli:resume with no prior taskId", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const monitorService = makeMockCanonicalMonitorService("server-assigned-resume-id");
    const handler = new CliWsHandler(bridge, monitorService);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:resume",
      cli: "opencode",
      sessionId: "opencode-session-1",
      workdir: "/tmp",
      prompt: "continue",
    });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBe("server-assigned-resume-id");
  });

  it("falls back to client taskId when monitorService is unavailable (no monitorService)", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    // No monitorService — handler constructed without it
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:start", cli: "opencode", workdir: "/tmp", prompt: "hello", taskId: "client-task"
    });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBe("client-task");
  });

  it("omits taskId from cli:started for OpenCode when monitorService unavailable and none provided", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "opencode", workdir: "/tmp", prompt: "hello" });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// taskId echo in cli:started (Bug #2 regression guard)
// ---------------------------------------------------------------------------

describe("CliWsHandler — taskId echo", () => {
  it("echoes taskId in cli:started when provided in cli:start", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:start",
      cli: "claude",
      workdir: "/tmp",
      prompt: "hello",
      taskId: "task-abc"
    });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBe("task-abc");
  });

  it("omits taskId from cli:started when not provided", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, { type: "cli:start", cli: "claude", workdir: "/tmp", prompt: "hello" });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBeUndefined();
  });

  it("echoes taskId in cli:started when provided in cli:resume", async () => {
    const mockProcess = makeMockProcess();
    const bridge = makeMockBridgeService(mockProcess);
    const handler = new CliWsHandler(bridge);
    const ws = makeMockWs();
    attachAndConnect(handler, ws);

    sendWsMessage(ws, {
      type: "cli:resume",
      cli: "claude",
      sessionId: "sess-existing",
      workdir: "/tmp",
      prompt: "continue",
      taskId: "task-xyz"
    });
    await new Promise((r) => setTimeout(r, 0));

    const startedRaw = ws._sent.find((s) => s.includes("cli:started"));
    expect(startedRaw).toBeDefined();
    const started = JSON.parse(startedRaw!);
    expect(started.taskId).toBe("task-xyz");
  });
});
