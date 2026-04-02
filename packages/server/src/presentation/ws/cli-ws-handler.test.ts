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
    await Promise.resolve();

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
    await Promise.resolve();

    // Process exits without cancel
    mockProcess._resolveWait(0);
    await Promise.resolve();
    await Promise.resolve();

    const completeMsg = ws._sent.find((s) => s.includes("cli:complete"));
    expect(completeMsg).toBeDefined();
  });
});
