/**
 * @module presentation/ws/cli-ws-handler
 *
 * CLI WebSocket handler. Manages CLI chat sessions over WebSocket.
 */

import type { WebSocket, WebSocketServer } from "ws";
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

export class CliWsHandler {
  private readonly clientProcesses = new Map<WebSocket, Set<string>>();

  constructor(private readonly bridgeService: CliBridgeService) {}

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
    message: { cli: "claude" | "opencode"; workdir: string; prompt: string; taskId?: string; requestId?: string }
  ): Promise<void> {
    try {
      const options: Parameters<CliBridgeService["startChat"]>[0] = {
        cli: message.cli,
        workdir: message.workdir,
        prompt: message.prompt,
      };
      if (message.taskId) {
        (options as { taskId?: string }).taskId = message.taskId;
      }
      const process = await this.bridgeService.startChat(options);

      this.trackProcess(ws, process);
      this.sendStarted(ws, process, message.requestId);
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
    }
  ): Promise<void> {
    try {
      const options: Parameters<CliBridgeService["resumeChat"]>[0] = {
        cli: message.cli,
        sessionId: message.sessionId,
        workdir: message.workdir,
        prompt: message.prompt,
      };
      if (message.taskId) {
        (options as { taskId?: string }).taskId = message.taskId;
      }
      const process = await this.bridgeService.resumeChat(options);

      this.trackProcess(ws, process);
      this.sendStarted(ws, process, message.requestId);
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

  private handleSendMessage(
    ws: WebSocket,
    message: { processId: string; message: string }
  ): void {
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
    const cancelled = this.bridgeService.cancelChat(message.processId);
    if (!cancelled) {
      this.sendError(ws, message.processId, "Process not found or already terminated");
    }
    this.clientProcesses.get(ws)?.delete(message.processId);
  }

  private handleDisconnect(ws: WebSocket): void {
    const processIds = this.clientProcesses.get(ws);
    if (processIds) {
      for (const processId of processIds) {
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
      this.send(ws, {
        type: "cli:complete",
        processId: process.processId,
        sessionId: process.sessionId,
        exitCode,
      });
      this.bridgeService.removeProcess(process.processId);
      this.clientProcesses.get(ws)?.delete(process.processId);
    });
  }

  private sendStarted(ws: WebSocket, process: CliProcess, requestId?: string): void {
    this.send(ws, {
      type: "cli:started",
      processId: process.processId,
      sessionId: process.sessionId,
      cli: process.cli,
      ...(requestId ? { requestId } : {}),
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
