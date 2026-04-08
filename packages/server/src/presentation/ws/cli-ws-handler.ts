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
  isCliInterruptTaskMessage,
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
  private readonly processTaskIds = new Map<string, string>();
  private readonly processResponseBuffers = new Map<string, string[]>();
  private readonly processToolCallIds = new Map<string, Set<string>>();
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
      void this.handleSendMessage(ws, message);
    } else if (isCliCancelMessage(message)) {
      this.handleCancel(ws, message);
    } else if (isCliInterruptTaskMessage(message)) {
      this.handleInterruptTask(ws, message);
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
      const guardError = await this.getTaskGuardError(resolvedTaskId);
      if (guardError) {
        this.sendError(ws, undefined, guardError, message.requestId);
        return;
      }

      const options: Parameters<CliBridgeService["startChat"]>[0] = {
        cli: message.cli,
        workdir: message.workdir,
        prompt: message.prompt,
        ...(resolvedTaskId ? { taskId: resolvedTaskId } : {}),
        ...(message.model ? { model: message.model } : {}),
      };
      await this.recordCliPrompt(resolvedTaskId, message.prompt, message.cli, message.requestId);
      const process = await this.bridgeService.startChat(options);
      this.trackProcess(ws, process, resolvedTaskId);

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
      const guardError = await this.getTaskGuardError(resolvedTaskId);
      if (guardError) {
        this.sendError(ws, undefined, guardError, message.requestId);
        return;
      }

      const options: Parameters<CliBridgeService["resumeChat"]>[0] = {
        cli: message.cli,
        sessionId: message.sessionId,
        workdir: message.workdir,
        prompt: message.prompt,
        ...(resolvedTaskId ? { taskId: resolvedTaskId } : {}),
        ...(message.model ? { model: message.model } : {}),
      };
      await this.recordCliPrompt(resolvedTaskId, message.prompt, message.cli, message.requestId);
      const process = await this.bridgeService.resumeChat(options);
      this.trackProcess(ws, process, resolvedTaskId);

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
        runtimeSource: "opencode-bridge",
      });
      return task.id;
    } catch {
      // Never block the chat start on monitor unavailability.
      return undefined;
    }
  }

  private async handleSendMessage(
    ws: WebSocket,
    message: { processId: string; message: string }
  ): Promise<void> {
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
    const guardError = await this.getTaskGuardError(this.processTaskIds.get(message.processId));
    if (guardError) {
      this.sendError(ws, message.processId, guardError);
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
      this.processTaskIds.delete(message.processId);
      this.processResponseBuffers.delete(message.processId);
      this.clientProcesses.get(ws)?.delete(message.processId);
      return;
    }
    this.clientProcesses.get(ws)?.delete(message.processId);
    this.processTaskIds.delete(message.processId);
    this.processResponseBuffers.delete(message.processId);
  }

  private handleInterruptTask(
    ws: WebSocket,
    message: { taskId: string }
  ): void {
    const taskId = message.taskId?.trim();
    if (!taskId) {
      this.sendError(ws, undefined, "taskId is required");
      return;
    }

    const processId = [...this.processTaskIds.entries()]
      .find(([, linkedTaskId]) => linkedTaskId === taskId)?.[0];

    if (!processId) {
      this.sendError(ws, undefined, "No active CLI process found for task");
      return;
    }

    this.cancelledProcesses.add(processId);
    const cancelled = this.bridgeService.cancelChat(processId);
    if (!cancelled) {
      this.cancelledProcesses.delete(processId);
      this.sendError(ws, processId, "Process not found or already terminated");
      this.processTaskIds.delete(processId);
      this.processResponseBuffers.delete(processId);
      return;
    }

    this.processTaskIds.delete(processId);
    this.processResponseBuffers.delete(processId);
    this.clientProcesses.get(ws)?.delete(processId);
  }

  private handleDisconnect(ws: WebSocket): void {
    const processIds = this.clientProcesses.get(ws);
    if (processIds) {
      for (const processId of processIds) {
        this.cancelledProcesses.add(processId);
        this.bridgeService.cancelChat(processId);
        this.processTaskIds.delete(processId);
        this.processResponseBuffers.delete(processId);
      }
    }
    this.clientProcesses.delete(ws);
  }

  private trackProcess(ws: WebSocket, process: CliProcess, taskId?: string): void {
    this.clientProcesses.get(ws)?.add(process.processId);
    if (taskId) {
      this.processTaskIds.set(process.processId, taskId);
    }
    this.processResponseBuffers.set(process.processId, []);
    this.processToolCallIds.set(process.processId, new Set());
  }

  private streamOutput(ws: WebSocket, process: CliProcess): void {
    let buffer = "";
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const clearInactivityTimer = (): void => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    };

    const scheduleInactivityTimeout = (): void => {
      clearInactivityTimer();
      if (process.cli !== "opencode") {
        return;
      }
      inactivityTimer = setTimeout(() => {
        if (this.cancelledProcesses.has(process.processId)) {
          return;
        }
        this.cancelledProcesses.add(process.processId);
        process.kill();
        this.sendError(
          ws,
          process.processId,
          "OpenCode Bridge stalled while handling a complex prompt. Try Claude Code here, or run OpenCode directly in its native environment."
        );
      }, 20_000);
    };

    scheduleInactivityTimeout();

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
      scheduleInactivityTimeout();
      buffer += chunk.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          const extractedContent = extractEventContent(event);
          const linkedTaskId = this.processTaskIds.get(process.processId);
          if (linkedTaskId && process.cli === "opencode" && event.type === "tool_use") {
            void this.recordOpenCodeBridgeToolUse(linkedTaskId, process.processId, event);
          }
          if (extractedContent) {
            const bufferForProcess = this.processResponseBuffers.get(process.processId) ?? [];
            bufferForProcess.push(extractedContent);
            this.processResponseBuffers.set(process.processId, bufferForProcess);
          }
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
      clearInactivityTimer();
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          const extractedContent = extractEventContent(event);
          const linkedTaskId = this.processTaskIds.get(process.processId);
          if (linkedTaskId && process.cli === "opencode" && event.type === "tool_use") {
            void this.recordOpenCodeBridgeToolUse(linkedTaskId, process.processId, event);
          }
          if (extractedContent) {
            const bufferForProcess = this.processResponseBuffers.get(process.processId) ?? [];
            bufferForProcess.push(extractedContent);
            this.processResponseBuffers.set(process.processId, bufferForProcess);
          }
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
      clearInactivityTimer();
      const wasCancelled = this.cancelledProcesses.has(process.processId);
      this.cancelledProcesses.delete(process.processId);
      this.bridgeService.removeProcess(process.processId);
      this.clientProcesses.get(ws)?.delete(process.processId);
      const linkedTaskId = this.processTaskIds.get(process.processId);
      this.processTaskIds.delete(process.processId);
      const responseChunks = this.processResponseBuffers.get(process.processId) ?? [];
      this.processResponseBuffers.delete(process.processId);
      this.processToolCallIds.delete(process.processId);
      if (!wasCancelled && linkedTaskId && responseChunks.length > 0) {
        void this.recordCliAssistantResponse(linkedTaskId, responseChunks.join(""), process.cli, process.processId);
      }
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

  private async getTaskGuardError(taskId: string | undefined): Promise<string | undefined> {
    if (!taskId || !this.monitorService) {
      return undefined;
    }
    const task = await this.monitorService.getTask(taskId);
    if (!task) {
      return undefined;
    }
    if (task.status === "waiting") {
      return "Task is waiting for approval before more messages can be sent";
    }
    if (task.status === "errored") {
      return "Task is blocked by a rule and cannot continue";
    }
    return undefined;
  }

  private async recordCliPrompt(
    taskId: string | undefined,
    prompt: string,
    cli: "claude" | "opencode",
    requestId?: string
  ): Promise<void> {
    if (!taskId || !this.monitorService) {
      return;
    }

    try {
      await this.monitorService.logUserMessage({
        taskId,
        messageId: requestId ?? globalThis.crypto.randomUUID(),
        captureMode: "raw",
        source: `${cli}-bridge`,
        title: prompt.length > 120 ? `${prompt.slice(0, 120)}…` : prompt,
        body: prompt
      });
    } catch {
      // Never block CLI execution on monitor logging failures.
    }
  }

  private async recordCliAssistantResponse(
    taskId: string,
    body: string,
    cli: "claude" | "opencode",
    processId: string
  ): Promise<void> {
    if (!this.monitorService) {
      return;
    }

    const normalized = body.trim();
    if (!normalized) {
      return;
    }

    try {
      await this.monitorService.logAssistantResponse({
        taskId,
        messageId: `${processId}:assistant`,
        source: `${cli}-bridge`,
        title: normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized,
        body: normalized
      });
    } catch {
      // Best-effort only.
    }
  }

  private async recordOpenCodeBridgeToolUse(
    taskId: string,
    processId: string,
    event: Record<string, unknown>
  ): Promise<void> {
    if (!this.monitorService) {
      return;
    }

    const part = typeof event["part"] === "object" && event["part"] !== null
      ? event["part"] as Record<string, unknown>
      : undefined;
    const toolName = typeof part?.["tool"] === "string" ? part["tool"] : "";
    if (!toolName) {
      return;
    }

    const callId = typeof part?.["callID"] === "string" ? part["callID"] : "";
    if (callId) {
      const seen = this.processToolCallIds.get(processId) ?? new Set<string>();
      if (seen.has(callId)) {
        return;
      }
      seen.add(callId);
      this.processToolCallIds.set(processId, seen);
    }

    const state = typeof part?.["state"] === "object" && part["state"] !== null
      ? part["state"] as Record<string, unknown>
      : {};
    const input = typeof state["input"] === "object" && state["input"] !== null
      ? state["input"] as Record<string, unknown>
      : {};
    const outputText = stringifyBridgeToolOutput(state["output"]);
    const filePaths = extractBridgeFilePaths(input, outputText);
    const metadata = {
      source: "opencode-bridge",
      bridgeSynthetic: true,
      callId,
      ...(filePaths.length > 0 ? { filePaths } : {})
    };

    const lowerToolName = toolName.toLowerCase();
    const bridgeToolMeta = parseBridgeToolMeta(toolName);
    const title = bridgeToolMeta.title;

    if (bridgeToolMeta.activityType) {
      await this.monitorService.logAgentActivity({
        taskId,
        activityType: bridgeToolMeta.activityType,
        title,
        ...(outputText ? { body: outputText } : {}),
        metadata: {
          ...metadata,
          ...(bridgeToolMeta.mcpServer ? { mcpServer: bridgeToolMeta.mcpServer } : {}),
          ...(bridgeToolMeta.mcpTool ? { mcpTool: bridgeToolMeta.mcpTool } : {})
        },
        ...(bridgeToolMeta.mcpServer ? { mcpServer: bridgeToolMeta.mcpServer } : {}),
        ...(bridgeToolMeta.mcpTool ? { mcpTool: bridgeToolMeta.mcpTool } : {})
      });
      return;
    }

    if (isBridgeDelegationTool(lowerToolName, input)) {
      await this.monitorService.logAgentActivity({
        taskId,
        activityType: "delegation",
        title,
        ...(outputText ? { body: outputText } : {}),
        metadata
      });
      return;
    }

    if (isBridgeExplorationTool(lowerToolName)) {
      await this.monitorService.logExploration({
        taskId,
        toolName,
        title,
        ...(outputText ? { body: outputText } : {}),
        lane: "exploration",
        metadata
      });
      return;
    }

    await this.monitorService.logToolUsed({
      taskId,
      toolName,
      title,
      ...(outputText ? { body: outputText } : {}),
      metadata
    });
  }
}

function isBridgeExplorationTool(toolName: string): boolean {
  return /\b(read|view|open|glob|grep|search|fetch|websearch|webfetch|list)\b/.test(toolName);
}

function isBridgeDelegationTool(toolName: string, input: Record<string, unknown>): boolean {
  if (toolName === "task" || toolName === "parallel") {
    return true;
  }
  return input["run_in_background"] === true;
}

function stringifyBridgeToolOutput(output: unknown): string {
  if (typeof output === "string") {
    return output.slice(0, 800);
  }
  const serialized = JSON.stringify(output ?? {});
  return serialized.length > 800 ? `${serialized.slice(0, 800)}…` : serialized;
}

function extractBridgeFilePaths(input: Record<string, unknown>, outputText: string): string[] {
  const candidates = [
    typeof input["filePath"] === "string" ? input["filePath"] : undefined,
    typeof input["path"] === "string" ? input["path"] : undefined
  ].filter((value): value is string => Boolean(value));

  const pathMatch = outputText.match(/<path>([^<]+)<\/path>/i);
  if (pathMatch?.[1]) {
    candidates.push(pathMatch[1]);
  }

  return [...new Set(candidates)];
}

function humanizeBridgeToolName(toolName: string): string {
  return toolName
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBridgeToolMeta(toolName: string): {
  title: string;
  activityType?: "mcp_call" | "search";
  mcpServer?: string;
  mcpTool?: string;
} {
  const normalized = toolName.toLowerCase();
  const humanized = humanizeBridgeToolName(toolName);

  if (normalized.startsWith("monitor_monitor_find_similar_workflows") || normalized.startsWith("monitor_find_similar_workflows")) {
    return {
      title: "Workflow search: monitor/find_similar_workflows",
      activityType: "search",
      mcpServer: "monitor",
      mcpTool: "find_similar_workflows"
    };
  }

  const mcpMatch = normalized.match(/^([a-z0-9]+)_([a-z0-9_]+)$/);
  if (mcpMatch && mcpMatch[1] && mcpMatch[2] && !isBridgeExplorationTool(normalized)) {
    return {
      title: `Bridge MCP: ${mcpMatch[1]}/${mcpMatch[2]}`,
      activityType: "mcp_call",
      mcpServer: mcpMatch[1],
      mcpTool: mcpMatch[2]
    };
  }

  return {
    title: `Bridge tool: ${humanized || toolName}`
  };
}
