/**
 * @module presentation/ws/cli-ws-handler
 *
 * CLI WebSocket handler. Manages CLI chat sessions over WebSocket.
 */

import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { WebSocket, WebSocketServer } from "ws";
import type { MonitorService } from "../../application/monitor-service.js";
import type { CliBridgeService } from "../../application/cli-bridge/cli-bridge-service.js";
import type { CliProcess } from "../../application/cli-bridge/types.js";
import {
  isCliClientMessage,
  isCliStartMessage,
  isCliResumeMessage,
  isCliMessageMessage,
  isCliCancelMessage,
  type CliServerMessage,
} from "./cli-ws-types.js";

/**
 * Validate that a workdir value is a non-empty absolute path that exists on disk.
 * Returns an error string if invalid, undefined if OK.
 */
function validateWorkdir(workdir: unknown): string | undefined {
  if (typeof workdir !== "string" || workdir.trim() === "") {
    return "workdir must be a non-empty string";
  }
  if (!isAbsolute(workdir)) {
    return "workdir must be an absolute path";
  }
  if (!existsSync(workdir)) {
    return `workdir does not exist: ${workdir}`;
  }
  return undefined;
}

export class CliWsHandler {
  private readonly clientProcesses = new Map<WebSocket, Set<string>>();
  /** Tracks processIds that were explicitly cancelled so wait() can skip cli:complete. */
  private readonly cancelledProcesses = new Set<string>();

  constructor(
    private readonly bridgeService: CliBridgeService,
    private readonly monitorService?: MonitorService
  ) {}

  attach(wss: WebSocketServer): void {
    wss.on("connection", (ws) => this.handleConnection(ws));
  }

  private handleConnection(ws: WebSocket): void {
    this.clientProcesses.set(ws, new Set());

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (isCliClientMessage(message)) {
          void this.handleMessage(ws, message);
        } else {
          this.sendError(ws, undefined, "Unknown message type");
        }
      } catch {
        this.sendError(ws, undefined, "Invalid JSON message");
      }
    });

    ws.on("close", () => this.handleDisconnect(ws));
    ws.on("error", () => this.handleDisconnect(ws));
  }

  private async handleMessage(
    ws: WebSocket,
    message: ReturnType<typeof JSON.parse>
  ): Promise<void> {
    if (isCliStartMessage(message)) {
      await this.handleStart(ws, message);
    } else if (isCliResumeMessage(message)) {
      await this.handleResume(ws, message);
    } else if (isCliMessageMessage(message)) {
      this.handleSendMessage(ws, message);
    } else if (isCliCancelMessage(message)) {
      this.handleCancel(ws, message);
    }
  }

  private async handleStart(
    ws: WebSocket,
    message: { cli: "claude" | "opencode"; workdir: string; prompt: string; taskId?: string; requestId?: string; model?: string }
  ): Promise<void> {
    const workdirError = validateWorkdir(message.workdir);
    if (workdirError) {
      this.sendError(ws, undefined, workdirError, message.requestId);
      return;
    }
    if (!message.prompt || typeof message.prompt !== "string" || message.prompt.trim() === "") {
      this.sendError(ws, undefined, "prompt must be a non-empty string", message.requestId);
      return;
    }
    try {
      // For OpenCode, register/resolve the canonical taskId before spawning so the
      // client receives it in cli:started and can reuse it on every subsequent resume.
      // This is safe to await here — stream listeners are attached after startChat,
      // and OpenCode's fast-exit race is with streamOutput, not with this registration.
      let resolvedTaskId = message.taskId;
      if (message.cli === "opencode") {
        resolvedTaskId = await this.registerOpencodeTask({
          ...(message.taskId ? { taskId: message.taskId } : {}),
          workdir: message.workdir,
          prompt: message.prompt,
        }) ?? message.taskId;
      }

      const options: Parameters<CliBridgeService["startChat"]>[0] = {
        cli: message.cli,
        workdir: message.workdir,
        prompt: message.prompt,
        ...(resolvedTaskId ? { taskId: resolvedTaskId } : {}),
        ...(message.model ? { model: message.model } : {}),
      };
      const process = await this.bridgeService.startChat(options);
      this.trackProcess(ws, process);

      // IMPORTANT: attach stream listeners immediately, before any async work,
      // so we never miss stdout data if the process exits quickly.
      this.sendStarted(ws, process, message.requestId, resolvedTaskId);
      this.streamOutput(ws, process);
    } catch (error) {
      this.sendError(
        ws,
        undefined,
        error instanceof Error ? error.message : String(error),
        message.requestId
      );
    }
  }

  private async handleResume(
    ws: WebSocket,
    message: {
      cli: "claude" | "opencode";
      sessionId: string;
      workdir: string;
      prompt: string;
      taskId?: string;
      requestId?: string;
      model?: string;
    }
  ): Promise<void> {
    const workdirError = validateWorkdir(message.workdir);
    if (workdirError) {
      this.sendError(ws, undefined, workdirError, message.requestId);
      return;
    }
    if (!message.prompt || typeof message.prompt !== "string" || message.prompt.trim() === "") {
      this.sendError(ws, undefined, "prompt must be a non-empty string", message.requestId);
      return;
    }
    try {
      // Same as handleStart: resolve canonical taskId before spawn for OpenCode.
      let resolvedTaskId = message.taskId;
      if (message.cli === "opencode") {
        resolvedTaskId = await this.registerOpencodeTask({
          ...(message.taskId ? { taskId: message.taskId } : {}),
          workdir: message.workdir,
          prompt: message.prompt,
        }) ?? message.taskId;
      }

      const options: Parameters<CliBridgeService["resumeChat"]>[0] = {
        cli: message.cli,
        sessionId: message.sessionId,
        workdir: message.workdir,
        prompt: message.prompt,
        ...(resolvedTaskId ? { taskId: resolvedTaskId } : {}),
        ...(message.model ? { model: message.model } : {}),
      };
      const process = await this.bridgeService.resumeChat(options);
      this.trackProcess(ws, process);

      this.sendStarted(ws, process, message.requestId, resolvedTaskId);
      this.streamOutput(ws, process);
    } catch (error) {
      this.sendError(
        ws,
        undefined,
        error instanceof Error ? error.message : String(error),
        message.requestId
      );
    }
  }

  /**
   * Registers or updates an OpenCode task in the monitor service.
   * Called before spawning so the task appears in the dashboard even if the
   * OpenCode monitor plugin does not fire (e.g., in --format json headless mode).
   * Returns the canonical taskId (newly created or the existing one passed in).
   */
  private async registerOpencodeTask(input: {
    taskId?: string;
    workdir: string;
    prompt: string;
  }): Promise<string | undefined> {
    if (!this.monitorService) return undefined;
    try {
      const title = input.prompt.length > 80
        ? `${input.prompt.slice(0, 80)}…`
        : input.prompt;
      const { task } = await this.monitorService.startTask({
        ...(input.taskId ? { taskId: input.taskId } : {}),
        title,
        workspacePath: input.workdir,
        runtimeSource: "opencode",
      });
      return task.id;
    } catch {
      // Never block the chat start on monitor unavailability.
      return undefined;
    }
  }

  private handleSendMessage(
    ws: WebSocket,
    message: { processId: string; message: string }
  ): void {
    if (!message.processId || typeof message.processId !== "string") {
      this.sendError(ws, undefined, "processId is required");
      return;
    }
    if (!message.message || typeof message.message !== "string" || message.message.trim() === "") {
      this.sendError(ws, message.processId, "message must be a non-empty string");
      return;
    }
    const process = this.bridgeService.getProcess(message.processId);
    if (!process) {
      this.sendError(ws, message.processId, "Process not found");
      return;
    }

    try {
      process.sendMessage(message.message);
    } catch (error) {
      this.sendError(
        ws,
        message.processId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private handleCancel(
    ws: WebSocket,
    message: { processId: string }
  ): void {
    if (!message.processId || typeof message.processId !== "string") {
      this.sendError(ws, undefined, "processId is required");
      return;
    }
    // Mark as cancelled before calling cancel so streamOutput's wait() sees it.
    this.cancelledProcesses.add(message.processId);
    const cancelled = this.bridgeService.cancelChat(message.processId);
    if (!cancelled) {
      this.cancelledProcesses.delete(message.processId);
      this.sendError(ws, message.processId, "Process not found or already terminated");
    }
    this.clientProcesses.get(ws)?.delete(message.processId);
  }

  private handleDisconnect(ws: WebSocket): void {
    const processIds = this.clientProcesses.get(ws);
    if (processIds) {
      for (const processId of processIds) {
        this.cancelledProcesses.add(processId);
        this.bridgeService.cancelChat(processId);
      }
    }
    this.clientProcesses.delete(ws);
  }

  private trackProcess(ws: WebSocket, process: CliProcess): void {
    this.clientProcesses.get(ws)?.add(process.processId);
  }

  private streamOutput(ws: WebSocket, process: CliProcess): void {
    let buffer = "";

    const extractEventContent = (event: Record<string, unknown>): string | undefined => {
      const direct = typeof event.content === "string"
        ? event.content
        : typeof event.text === "string"
          ? event.text
          : undefined;
      if (direct) return direct;

      // OpenCode --format json wraps content in { part: { text: "..." } }
      const part = typeof event.part === "object" && event.part !== null
        ? event.part as Record<string, unknown>
        : undefined;
      if (part && typeof part.text === "string") {
        return part.text;
      }

      const delta = typeof event.delta === "object" && event.delta !== null
        ? event.delta as Record<string, unknown>
        : undefined;
      if (delta && typeof delta.text === "string") {
        return delta.text;
      }

      const error = typeof event.error === "object" && event.error !== null
        ? event.error as Record<string, unknown>
        : undefined;
      if (error && typeof error.message === "string") {
        return error.message;
      }
      // OpenCode wraps API errors as { error: { name, data: { message } } }
      if (error) {
        const errorData = typeof error.data === "object" && error.data !== null
          ? error.data as Record<string, unknown>
          : undefined;
        if (errorData && typeof errorData.message === "string") {
          return errorData.message;
        }
      }

      const message = typeof event.message === "object" && event.message !== null
        ? event.message as Record<string, unknown>
        : undefined;
      if (message) {
        if (typeof message.content === "string") {
          return message.content;
        }

        if (Array.isArray(message.content)) {
          const parts = message.content
            .map((entry) => (typeof entry === "object" && entry !== null
              ? entry as Record<string, unknown>
              : undefined))
            .filter((entry): entry is Record<string, unknown> => entry !== undefined)
            .map((entry) => {
              if (typeof entry.text === "string") {
                return entry.text;
              }
              if (typeof entry.thinking === "string") {
                return entry.thinking;
              }
              return undefined;
            })
            .filter((part): part is string => Boolean(part && part.trim()));

          if (parts.length > 0) {
            return parts.join("\n");
          }
        }
      }

      if (typeof event.result === "string") {
        return event.result;
      }

      return undefined;
    };

    process.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          const extractedContent = extractEventContent(event);
          this.send(ws, {
            type: "cli:stream",
            processId: process.processId,
            event: event.type ?? "unknown",
            ...(extractedContent !== undefined ? { content: extractedContent } : {}),
            metadata: event,
          });
        } catch {
          this.send(ws, {
            type: "cli:stream",
            processId: process.processId,
            event: "raw",
            content: line,
          });
        }
      }
    });

    process.stdout.on("end", () => {
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          const extractedContent = extractEventContent(event);
          this.send(ws, {
            type: "cli:stream",
            processId: process.processId,
            event: event.type ?? "unknown",
            ...(extractedContent !== undefined ? { content: extractedContent } : {}),
            metadata: event,
          });
        } catch {
          this.send(ws, {
            type: "cli:stream",
            processId: process.processId,
            event: "raw",
            content: buffer,
          });
        }
      }
    });

    void process.wait().then((exitCode) => {
      const wasCancelled = this.cancelledProcesses.has(process.processId);
      this.cancelledProcesses.delete(process.processId);
      this.bridgeService.removeProcess(process.processId);
      this.clientProcesses.get(ws)?.delete(process.processId);
      // Do not send cli:complete for explicitly cancelled processes — the client
      // already transitioned state when it sent cli:cancel.
      if (!wasCancelled) {
        this.send(ws, {
          type: "cli:complete",
          processId: process.processId,
          sessionId: process.sessionId,
          exitCode,
        });
      }
    });
  }

  private sendStarted(ws: WebSocket, process: CliProcess, requestId?: string, taskId?: string): void {
    this.send(ws, {
      type: "cli:started",
      processId: process.processId,
      sessionId: process.sessionId,
      cli: process.cli,
      ...(requestId ? { requestId } : {}),
      ...(taskId ? { taskId } : {}),
    });
  }

  private sendError(ws: WebSocket, processId: string | undefined, error: string, requestId?: string): void {
    const errorMessage: CliServerMessage = processId
      ? { type: "cli:error", processId, error, ...(requestId ? { requestId } : {}) }
      : { type: "cli:error", error, ...(requestId ? { requestId } : {}) };
    this.send(ws, errorMessage);
  }

  private send(ws: WebSocket, message: CliServerMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}
