/**
 * @module application/cli-bridge/cli-bridge-service
 *
 * CLI Bridge service. Manages adapter registry and active CLI processes.
 */

import type {
  CliAdapter,
  CliProcess,
  CliSessionOptions,
  CliResumeOptions,
  CliType,
} from "./types.js";
import type { MonitorService } from "../monitor-service.js";

export interface StartChatOptions {
  readonly cli: CliType;
  readonly workdir: string;
  readonly prompt: string;
  readonly taskId?: string;
  readonly model?: string;
}

export interface ResumeChatOptions {
  readonly cli: CliType;
  readonly sessionId: string;
  readonly workdir: string;
  readonly prompt: string;
  readonly taskId?: string;
  readonly model?: string;
}

export class CliBridgeService {
  private readonly adapters: Map<CliType, CliAdapter>;
  private readonly activeProcesses: Map<string, CliProcess>;

  constructor(
    adapters: readonly CliAdapter[],
    private readonly monitorService?: MonitorService
  ) {
    this.adapters = new Map();
    this.activeProcesses = new Map();
    for (const adapter of adapters) {
      this.adapters.set(adapter.name, adapter);
    }
  }

  getAdapter(cli: CliType): CliAdapter | undefined {
    return this.adapters.get(cli);
  }

  listAdapters(): readonly CliType[] {
    return Array.from(this.adapters.keys());
  }

  async startChat(options: StartChatOptions): Promise<CliProcess> {
    const adapter = this.adapters.get(options.cli);
    if (!adapter) {
      throw new Error(`Unknown CLI type: ${options.cli}`);
    }

    await this.ensureMonitoredTask({
      cli: options.cli,
      workdir: options.workdir,
      prompt: options.prompt,
      ...(options.taskId ? { taskId: options.taskId } : {}),
      mode: "start",
    });

    const sessionOptions: Omit<CliSessionOptions, "cli"> = {
      workdir: options.workdir,
      prompt: options.prompt,
      ...(options.taskId ? { taskId: options.taskId } : {}),
      ...(options.model ? { model: options.model } : {}),
    };

    const process = await adapter.startSession(sessionOptions);

    this.activeProcesses.set(process.processId, process);
    return process;
  }

  async resumeChat(options: ResumeChatOptions): Promise<CliProcess> {
    const adapter = this.adapters.get(options.cli);
    if (!adapter) {
      throw new Error(`Unknown CLI type: ${options.cli}`);
    }

    await this.ensureMonitoredTask({
      cli: options.cli,
      workdir: options.workdir,
      prompt: options.prompt,
      ...(options.taskId ? { taskId: options.taskId } : {}),
      sessionId: options.sessionId,
      mode: "resume",
    });

    const resumeOptions: Omit<CliResumeOptions, "cli"> = {
      sessionId: options.sessionId,
      workdir: options.workdir,
      prompt: options.prompt,
      ...(options.taskId ? { taskId: options.taskId } : {}),
      ...(options.model ? { model: options.model } : {}),
    };

    const process = await adapter.resumeSession(resumeOptions);

    this.activeProcesses.set(process.processId, process);
    return process;
  }

  getProcess(processId: string): CliProcess | undefined {
    return this.activeProcesses.get(processId);
  }

  cancelChat(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    if (!process) {
      return false;
    }

    process.kill();
    this.activeProcesses.delete(processId);
    return true;
  }

  removeProcess(processId: string): void {
    this.activeProcesses.delete(processId);
  }

  listActiveProcesses(): readonly string[] {
    return Array.from(this.activeProcesses.keys());
  }

  private async ensureMonitoredTask(input: {
    cli: CliType;
    workdir: string;
    prompt: string;
    taskId?: string;
    sessionId?: string;
    mode: "start" | "resume";
  }): Promise<void> {
    if (!this.monitorService || !input.taskId) {
      return;
    }

    const promptTitle = input.prompt.trim();
    const title = promptTitle.length > 80
      ? `${promptTitle.slice(0, 80)}…`
      : (promptTitle || `${input.cli} chat`);

    try {
      await this.monitorService.startTask({
        taskId: input.taskId,
        title,
        workspacePath: input.workdir,
        runtimeSource: input.cli === "opencode" ? "opencode-bridge" : "claude-code-bridge",
        summary: input.mode === "resume"
          ? `Resume ${input.cli} bridge session${input.sessionId ? ` ${input.sessionId}` : ""}`
          : `Start ${input.cli} bridge session`,
      });
    } catch {
      // Monitor availability must not block CLI bridge execution.
    }
  }

  async shutdownAll(): Promise<void> {
    const killPromises = Array.from(this.activeProcesses.values()).map(
      async (process) => {
        process.kill();
        try {
          await process.wait();
        } catch {
        }
      }
    );

    await Promise.all(killPromises);
    this.activeProcesses.clear();
  }
}
