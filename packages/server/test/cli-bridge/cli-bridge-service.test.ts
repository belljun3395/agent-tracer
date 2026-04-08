import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { CliBridgeService } from "../../src/application/cli-bridge/cli-bridge-service.js";
import type { MonitorService } from "../../src/application/monitor-service.js";
import type { CliAdapter, CliProcess, CliType } from "../../src/application/cli-bridge/types.js";

function createMockProcess(overrides: Partial<CliProcess> = {}): CliProcess {
  return {
    processId: overrides.processId ?? "proc-1",
    sessionId: overrides.sessionId ?? "session-1",
    cli: overrides.cli ?? "claude",
    stdout: overrides.stdout ?? new PassThrough(),
    sendMessage: overrides.sendMessage ?? vi.fn(),
    kill: overrides.kill ?? vi.fn(),
    wait: overrides.wait ?? vi.fn().mockResolvedValue(0),
  };
}

function createMockAdapter(name: CliType): CliAdapter & {
  startSession: ReturnType<typeof vi.fn>;
  resumeSession: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    startSession: vi.fn(),
    resumeSession: vi.fn(),
  };
}

function createMockMonitorService(): Pick<MonitorService, "startTask"> & {
  startTask: ReturnType<typeof vi.fn>;
} {
  return {
    startTask: vi.fn().mockResolvedValue({
      task: { id: "task-1" },
      sessionId: "session-1",
      events: []
    })
  } as unknown as Pick<MonitorService, "startTask"> & {
    startTask: ReturnType<typeof vi.fn>;
  };
}

describe("CliBridgeService", () => {
  it("returns registered adapters and lists their names", () => {
    const claude = createMockAdapter("claude");
    const opencode = createMockAdapter("opencode");
    const service = new CliBridgeService([claude, opencode]);

    expect(service.getAdapter("claude")).toBe(claude);
    expect(service.getAdapter("opencode")).toBe(opencode);
    expect(service.listAdapters()).toEqual(["claude", "opencode"]);
  });

  it("starts chat through the requested adapter and tracks the process", async () => {
    const claude = createMockAdapter("claude");
    const monitorService = createMockMonitorService();
    const process = createMockProcess({ processId: "start-proc", cli: "claude" });
    claude.startSession.mockResolvedValue(process);

    const service = new CliBridgeService([claude], monitorService as unknown as MonitorService);
    const result = await service.startChat({
      cli: "claude",
      workdir: "/repo",
      prompt: "hello",
      taskId: "task-1",
      model: "openai/gpt-5.4"
    });

    expect(claude.startSession).toHaveBeenCalledWith({
      workdir: "/repo",
      prompt: "hello",
      taskId: "task-1",
      model: "openai/gpt-5.4"
    });
    expect(monitorService.startTask).toHaveBeenCalledWith({
      taskId: "task-1",
      title: "hello",
      workspacePath: "/repo",
      runtimeSource: "claude-code-bridge",
      summary: "Start claude bridge session"
    });
    expect(result).toBe(process);
    expect(service.getProcess("start-proc")).toBe(process);
    expect(service.listActiveProcesses()).toEqual(["start-proc"]);
  });

  it("resumes chat through the requested adapter and tracks the process", async () => {
    const opencode = createMockAdapter("opencode");
    const monitorService = createMockMonitorService();
    const process = createMockProcess({
      processId: "resume-proc",
      sessionId: "ses-123",
      cli: "opencode"
    });
    opencode.resumeSession.mockResolvedValue(process);

    const service = new CliBridgeService([opencode], monitorService as unknown as MonitorService);
    const result = await service.resumeChat({
      cli: "opencode",
      sessionId: "ses-123",
      workdir: "/repo",
      prompt: "continue",
      taskId: "task-2",
      model: "openai/gpt-5.4"
    });

    expect(opencode.resumeSession).toHaveBeenCalledWith({
      sessionId: "ses-123",
      workdir: "/repo",
      prompt: "continue",
      taskId: "task-2",
      model: "openai/gpt-5.4"
    });
    expect(monitorService.startTask).toHaveBeenCalledWith({
      taskId: "task-2",
      title: "continue",
      workspacePath: "/repo",
      runtimeSource: "opencode-bridge",
      summary: "Resume opencode bridge session ses-123"
    });
    expect(result).toBe(process);
    expect(service.getProcess("resume-proc")).toBe(process);
    expect(service.listActiveProcesses()).toEqual(["resume-proc"]);
  });

  it("keeps running chats even when monitor integration fails", async () => {
    const claude = createMockAdapter("claude");
    const monitorService = createMockMonitorService();
    const process = createMockProcess({ processId: "monitor-fallback" });
    monitorService.startTask.mockRejectedValue(new Error("monitor unavailable"));
    claude.startSession.mockResolvedValue(process);

    const service = new CliBridgeService([claude], monitorService as unknown as MonitorService);
    const result = await service.startChat({
      cli: "claude",
      workdir: "/repo",
      prompt: "hello",
      taskId: "task-1"
    });

    expect(result).toBe(process);
    expect(claude.startSession).toHaveBeenCalledTimes(1);
    expect(service.getProcess("monitor-fallback")).toBe(process);
  });

  it("cancels tracked chats, removes them, and reports missing processes", async () => {
    const claude = createMockAdapter("claude");
    const process = createMockProcess({ processId: "cancel-proc" });
    const service = new CliBridgeService([claude]);

    claude.startSession.mockResolvedValue(process);
    await service.startChat({ cli: "claude", workdir: "/repo", prompt: "hello" });

    expect(service.cancelChat("cancel-proc")).toBe(true);
    expect(process.kill).toHaveBeenCalledTimes(1);
    expect(service.getProcess("cancel-proc")).toBeUndefined();
    expect(service.cancelChat("missing-proc")).toBe(false);
  });

  it("kills and waits for every tracked process during shutdown", async () => {
    const claude = createMockAdapter("claude");
    const first = createMockProcess({ processId: "proc-1" });
    const second = createMockProcess({
      processId: "proc-2",
      wait: vi.fn().mockRejectedValue(new Error("already exited"))
    });
    const service = new CliBridgeService([claude]);

    claude.startSession
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    await service.startChat({ cli: "claude", workdir: "/repo", prompt: "first" });
    await service.startChat({ cli: "claude", workdir: "/repo", prompt: "second" });

    await service.shutdownAll();

    expect(first.kill).toHaveBeenCalledTimes(1);
    expect(second.kill).toHaveBeenCalledTimes(1);
    expect(first.wait).toHaveBeenCalledTimes(1);
    expect(second.wait).toHaveBeenCalledTimes(1);
    expect(service.listActiveProcesses()).toEqual([]);
  });

  it("throws a clear error for unknown cli types", async () => {
    const service = new CliBridgeService([]);

    await expect(
      service.startChat({
        cli: "unknown" as CliType,
        workdir: "/repo",
        prompt: "hello"
      })
    ).rejects.toThrow("Unknown CLI type: unknown");

    await expect(
      service.resumeChat({
        cli: "unknown" as CliType,
        sessionId: "ses-1",
        workdir: "/repo",
        prompt: "hello"
      })
    ).rejects.toThrow("Unknown CLI type: unknown");
  });
});
