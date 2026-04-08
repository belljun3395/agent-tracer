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

  constructor(adapters: readonly CliAdapter[]) {
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
