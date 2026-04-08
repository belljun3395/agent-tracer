import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawn: vi.fn()
}));

function createMockChildProcess(): {
  child: ChildProcess;
  stdout: PassThrough;
  stdin: PassThrough;
  emitExit: (code: number) => void;
} {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stdin = new PassThrough();
  const stderr = new PassThrough();
  let killed = false;

  const child = emitter as unknown as ChildProcess;
  Object.defineProperty(child, "stdout", { value: stdout, writable: false, configurable: true });
  Object.defineProperty(child, "stdin", { value: stdin, writable: false, configurable: true });
  Object.defineProperty(child, "stderr", { value: stderr, writable: false, configurable: true });
  Object.defineProperty(child, "pid", { value: 12345, writable: true, configurable: true });
  Object.defineProperty(child, "exitCode", { value: null, writable: true, configurable: true });
  Object.defineProperty(child, "killed", {
    get: () => killed,
    configurable: true,
    set: (value: boolean) => {
      killed = value;
    }
  });

  child.kill = vi.fn((signal?: NodeJS.Signals | number) => {
    killed = true;
    emitter.emit("exit", signal === "SIGKILL" ? 137 : 0);
    return true;
  });

  return {
    child,
    stdout,
    stdin,
    emitExit: (code: number) => {
      Object.defineProperty(child, "exitCode", { value: code, writable: true });
      emitter.emit("exit", code);
    }
  };
}

function markPidUnavailable(child: ChildProcess): void {
  Object.defineProperty(child, "pid", { value: undefined, configurable: true });
}

describe("ClaudeCodeAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts claude process and extracts session id", async () => {
    const { spawn } = await import("node:child_process");
    const { ClaudeCodeAdapter } = await import("../../src/application/cli-bridge/claude-code-adapter.js");

    const mock = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(mock.child);

    const adapter = new ClaudeCodeAdapter();
    const process = await adapter.startSession({ workdir: "/tmp", prompt: "hello" });

    expect(spawn).toHaveBeenCalledWith(
      "claude",
      ["-p", "hello", "--output-format", "stream-json", "--verbose"],
      expect.objectContaining({ cwd: "/tmp" })
    );

    mock.stdout.write('{"type":"message_start","session_id":"claude-session"}\n');
    expect(process.sessionId).toBe("claude-session");

    const stdinWrite = vi.spyOn(mock.stdin, "write");
    process.sendMessage("next");
    expect(stdinWrite).toHaveBeenCalledWith('{"type":"user_message","content":"next"}\n');

    const waitPromise = process.wait();
    mock.emitExit(0);
    await expect(waitPromise).resolves.toBe(0);
  });

  it("does not fire SIGKILL when process exits within grace period", async () => {
    const { spawn } = await import("node:child_process");
    const { ClaudeCodeAdapter } = await import("../../src/application/cli-bridge/claude-code-adapter.js");

    const mock = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(mock.child);

    const adapter = new ClaudeCodeAdapter();
    const process = await adapter.startSession({ workdir: "/tmp", prompt: "hi" });

    process.kill();
    expect(mock.child.kill).toHaveBeenCalledWith("SIGTERM");

    mock.emitExit(0);
    vi.runAllTimers();

    const sigkillCalls = vi.mocked(mock.child.kill).mock.calls.filter(([signal]) => signal === "SIGKILL");
    expect(sigkillCalls).toHaveLength(0);
  });

  it("does fire SIGKILL when process ignores SIGTERM", async () => {
    const { spawn } = await import("node:child_process");
    const { ClaudeCodeAdapter } = await import("../../src/application/cli-bridge/claude-code-adapter.js");

    const mock = createMockChildProcess();
    vi.mocked(mock.child.kill).mockImplementation(() => true);
    vi.mocked(spawn).mockReturnValue(mock.child);

    const adapter = new ClaudeCodeAdapter();
    const process = await adapter.startSession({ workdir: "/tmp", prompt: "hi" });

    process.kill();
    expect(mock.child.kill).toHaveBeenCalledWith("SIGTERM");

    vi.runAllTimers();

    const sigkillCalls = vi.mocked(mock.child.kill).mock.calls.filter(([signal]) => signal === "SIGKILL");
    expect(sigkillCalls).toHaveLength(1);
  });

  it("fails fast when spawn pid is unavailable", async () => {
    const { spawn } = await import("node:child_process");
    const { ClaudeCodeAdapter } = await import("../../src/application/cli-bridge/claude-code-adapter.js");

    const mock = createMockChildProcess();
    markPidUnavailable(mock.child);
    vi.mocked(spawn).mockReturnValue(mock.child);

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.startSession({ workdir: "/tmp", prompt: "hi" }))
      .rejects
      .toThrow("Failed to spawn Claude CLI: executable not found or failed to start");
  });
});
