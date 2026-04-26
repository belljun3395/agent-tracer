/**
 * Codex App-Server Notification Normalizer
 *
 * Converts raw Codex app-server JSON-RPC notifications into RuntimeIngestEvent
 * objects for the Agent Tracer monitor ingest API.
 *
 * Codex app-server sends notifications (JSON-RPC objects without an id field)
 * over its SSE or WebSocket stream. Handled notification methods:
 *   thread/started       — a new agent thread has been created
 *   turn/started         — a model turn has started within a thread
 *   turn/completed       — a model turn has finished (completed|interrupted|failed)
 *   turn/plan/updated    — the plan steps for a turn have changed
 *   item/started         — a thread item has started (skips userMessage/hookPrompt)
 *   item/completed       — a thread item has finished; carries the final item state
 *
 * Item types handled on item/completed:
 *   agentMessage     → KIND.assistantResponse
 *   plan             → KIND.planLogged
 *   reasoning        → KIND.thoughtLogged
 *   commandExecution → KIND.terminalCommand  (with semantic lane inference)
 *   fileChange       → KIND.toolUsed         (with file-op semantic inference)
 *   mcpToolCall      → KIND.agentActivityLogged
 *   userMessage      → skipped  (captured upstream by UserPromptSubmit hook)
 *   hookPrompt       → skipped  (internal Codex hook prompt; not user-visible)
 *   (other)          → KIND.actionLogged     (generic fallback)
 *
 * Entry point: normalizeCodexAppServerNotification(notification, context)
 */
import * as path from "node:path";
import type { RuntimeIngestEvent } from "~shared/events/kinds.type.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferCommandSemantic } from "~shared/semantics/inference.command.js";
import { inferMcpSemantic } from "~shared/semantics/inference.coordination.js";
import { inferFileToolSemantic } from "~shared/semantics/inference.file.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";
import {ellipsize} from "~codex/util/utils.js";
import type {
    CodexAppServerCommandExecutionItem,
    CodexAppServerFileChangeItem,
    CodexAppServerNotification,
    CodexAppServerThreadItem,
    CodexAppServerTurn,
    CodexAppServerTurnPlanStep,
} from "./protocol.type.js";

export interface CodexAppServerNormalizationContext {
    readonly taskId: string;
    readonly sessionId: string;
}

const APP_SERVER_SOURCE = "codex-app-server";

export function normalizeCodexAppServerNotification(
    notification: CodexAppServerNotification,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent[] {
    switch (notification.method) {
        case "thread/started":
            return [buildThreadStartedEvent(notification, context)];
        case "turn/started":
            return [buildTurnStartedEvent(notification.params.threadId, notification.params.turn, context)];
        case "turn/completed":
            return [buildTurnCompletedEvent(notification.params.threadId, notification.params.turn, context)];
        case "turn/plan/updated":
            return [buildPlanUpdatedEvent(notification.params.threadId, notification.params.turnId, notification.params.explanation, notification.params.plan, context)];
        case "item/started":
            return buildItemStartedEvents(notification.params.threadId, notification.params.turnId, notification.params.item, context);
        case "item/completed":
            return buildItemCompletedEvents(notification.params.threadId, notification.params.turnId, notification.params.item, context);
        default:
            return [];
    }
}

function buildThreadStartedEvent(
    notification: Extract<CodexAppServerNotification, { method: "thread/started" }>,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const { thread } = notification.params;
    return {
        kind: KIND.contextSaved,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: thread.name ? `Thread started: ${thread.name}` : "Thread started",
        body: thread.name
            ? `Codex app-server thread started for ${thread.name}.`
            : "Codex app-server thread started.",
        lane: LANE.planning,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server thread/started notification."),
            trigger: "thread_started",
            threadId: thread.id,
            threadStatus: thread.status,
            ...(thread.cwd ? { cwd: thread.cwd } : {}),
            ...(thread.source ? { threadSource: thread.source } : {}),
        },
    };
}

function buildTurnStartedEvent(
    threadId: string,
    turn: CodexAppServerTurn,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    return {
        kind: KIND.actionLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: "Turn started",
        body: `Codex turn ${turn.id} started.`,
        lane: LANE.planning,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server turn/started notification."),
            threadId,
            turnId: turn.id,
            turnStatus: turn.status,
            ...(turn.startedAt !== null ? { turnStartedAt: turn.startedAt } : {}),
            ...(turn.durationMs !== null ? { turnDurationMs: turn.durationMs } : {}),
        },
    };
}

function buildTurnCompletedEvent(
    threadId: string,
    turn: CodexAppServerTurn,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const status = turn.status;
    const body = turn.error?.message || `Codex turn ${turn.id} ${humanizeStatus(status)}.`;

    return {
        kind: KIND.verificationLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: `Turn ${humanizeStatus(status).toLowerCase()}`,
        body,
        lane: LANE.planning,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server turn/completed notification."),
            verificationStatus: status,
            threadId,
            turnId: turn.id,
            ...(turn.startedAt !== null ? { turnStartedAt: turn.startedAt } : {}),
            ...(turn.completedAt !== null ? { turnCompletedAt: turn.completedAt } : {}),
            ...(turn.durationMs !== null ? { durationMs: turn.durationMs } : {}),
            ...(turn.error?.codexErrorInfo ? { codexErrorInfo: turn.error.codexErrorInfo } : {}),
            ...(turn.error?.additionalDetails !== undefined ? { additionalDetails: turn.error.additionalDetails } : {}),
        },
    };
}

function buildPlanUpdatedEvent(
    threadId: string,
    turnId: string,
    explanation: string | null,
    plan: readonly CodexAppServerTurnPlanStep[],
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const planText = formatStructuredPlan(plan);
    const body = [explanation?.trim(), planText].filter(Boolean).join("\n\n");

    return {
        kind: KIND.planLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: "Plan updated",
        ...(body ? { body } : {}),
        lane: LANE.planning,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server turn/plan/updated notification."),
            threadId,
            turnId,
            ...(explanation ? { explanation } : {}),
            plan,
        },
    };
}

function buildItemStartedEvents(
    threadId: string,
    turnId: string,
    item: CodexAppServerThreadItem,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent[] {
    if (item.type === "userMessage" || item.type === "hookPrompt") return [];

    const lane = resolveItemLane(item);
    const title = resolveItemStartedTitle(item);
    const body = resolveItemLifecycleBody(item);

    return [{
        kind: KIND.actionLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title,
        ...(body ? { body } : {}),
        lane,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/started notification."),
            threadId,
            turnId,
            itemId: item.id,
            itemType: item.type,
            itemLifecycle: "started",
            ...resolveItemStatusMetadata(item),
        },
    }];
}

function buildItemCompletedEvents(
    threadId: string,
    turnId: string,
    item: CodexAppServerThreadItem,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent[] {
    switch (item.type) {
        case "agentMessage":
            return [buildAgentMessageEvent(threadId, turnId, item, context)];
        case "plan":
            return [buildPlanItemEvent(threadId, turnId, item, context)];
        case "reasoning":
            return [buildReasoningEvent(threadId, turnId, item, context)];
        case "commandExecution":
            return [buildCommandExecutionEvent(threadId, turnId, item, context)];
        case "fileChange":
            return [buildFileChangeEvent(threadId, turnId, item, context)];
        case "mcpToolCall":
            return [buildMcpToolCallEvent(threadId, turnId, item, context)];
        case "userMessage":
        case "hookPrompt":
            return [];
        default:
            return [buildGenericCompletedItemEvent(threadId, turnId, item, context)];
    }
}

function buildAgentMessageEvent(
    threadId: string,
    turnId: string,
    item: Extract<CodexAppServerThreadItem, { type: "agentMessage" }>,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    return {
        kind: KIND.assistantResponse,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: ellipsize(item.text, 120),
        body: item.text,
        lane: LANE.user,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification for agentMessage."),
            messageId: item.id,
            stopReason: "item_completed",
            threadId,
            turnId,
            ...(item.phase ? { phase: item.phase } : {}),
        },
    };
}

function buildPlanItemEvent(
    threadId: string,
    turnId: string,
    item: Extract<CodexAppServerThreadItem, { type: "plan" }>,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    return {
        kind: KIND.planLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: ellipsize(item.text, 120),
        body: item.text,
        lane: LANE.planning,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification for plan."),
            threadId,
            turnId,
            itemId: item.id,
        },
    };
}

function buildReasoningEvent(
    threadId: string,
    turnId: string,
    item: Extract<CodexAppServerThreadItem, { type: "reasoning" }>,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const titleSource = item.summary[0] || item.content[0] || "Reasoning";
    const body = [...item.summary, ...item.content].join("\n");

    return {
        kind: KIND.thoughtLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: ellipsize(titleSource, 120),
        ...(body ? { body } : {}),
        lane: LANE.planning,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification for reasoning."),
            threadId,
            turnId,
            itemId: item.id,
            summaryCount: item.summary.length,
            contentCount: item.content.length,
        },
    };
}

function buildCommandExecutionEvent(
    threadId: string,
    turnId: string,
    item: CodexAppServerCommandExecutionItem,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const semantic = inferCommandSemantic(item.command);
    return {
        kind: KIND.terminalCommand,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: item.command.slice(0, 80),
        body: item.command,
        lane: semantic.lane,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification for commandExecution."),
            ...buildSemanticMetadata(semantic.metadata),
            command: item.command,
            threadId,
            turnId,
            itemId: item.id,
            commandStatus: item.status,
            cwd: item.cwd,
            ...(item.processId ? { processId: item.processId } : {}),
            ...(item.exitCode !== null ? { exitCode: item.exitCode } : {}),
            ...(item.durationMs !== null ? { durationMs: item.durationMs } : {}),
            ...(item.aggregatedOutput ? { aggregatedOutput: item.aggregatedOutput } : {}),
            ...(item.source ? { commandSource: item.source } : {}),
            ...(item.commandActions.length > 0 ? { commandActions: item.commandActions } : {}),
        },
    };
}

function buildFileChangeEvent(
    threadId: string,
    turnId: string,
    item: CodexAppServerFileChangeItem,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const filePaths = collectFilePaths(item.changes);
    const primaryPath = filePaths[0] ?? "";
    const semantic = inferFileToolSemantic(resolveFileSemanticToolName(item), primaryPath || undefined);
    const title = primaryPath
        ? `File change: ${path.basename(primaryPath)}`
        : `File changes: ${item.changes.length}`;
    const body = primaryPath
        ? `Codex proposed updates for ${primaryPath}.`
        : `Codex proposed ${item.changes.length} file changes.`;

    return {
        kind: KIND.toolUsed,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title,
        body,
        lane: LANE.implementation,
        ...(filePaths.length > 0 ? { filePaths } : {}),
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification for fileChange."),
            ...buildSemanticMetadata(semantic),
            toolName: "fileChange",
            threadId,
            turnId,
            itemId: item.id,
            fileChangeStatus: item.status,
            changeCount: item.changes.length,
            ...(primaryPath ? { filePath: primaryPath, relPath: primaryPath } : {}),
        },
    };
}

function buildMcpToolCallEvent(
    threadId: string,
    turnId: string,
    item: Extract<CodexAppServerThreadItem, { type: "mcpToolCall" }>,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    return {
        kind: KIND.agentActivityLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: `MCP: ${item.server}/${item.tool}`,
        body: `Used MCP tool ${item.server}/${item.tool}`,
        lane: LANE.coordination,
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification for mcpToolCall."),
            ...buildSemanticMetadata(inferMcpSemantic(item.server, item.tool, "CodexAppServer/mcpToolCall")),
            activityType: "mcp_call",
            mcpServer: item.server,
            mcpTool: item.tool,
            threadId,
            turnId,
            itemId: item.id,
            itemStatus: item.status,
            ...(item.durationMs !== null ? { durationMs: item.durationMs } : {}),
            ...(item.error ? { error: item.error } : {}),
            ...(item.result ? { result: item.result } : {}),
            arguments: item.arguments,
        },
    };
}

function buildGenericCompletedItemEvent(
    threadId: string,
    turnId: string,
    item: Exclude<CodexAppServerThreadItem, { type: "agentMessage" | "plan" | "reasoning" | "commandExecution" | "fileChange" | "mcpToolCall" | "userMessage" | "hookPrompt" }>,
    context: CodexAppServerNormalizationContext,
): RuntimeIngestEvent {
    const body = resolveItemLifecycleBody(item);
    return {
        kind: KIND.actionLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: `Item completed: ${humanizeItemType(item.type)}`,
        ...(body ? { body } : {}),
        lane: resolveItemLane(item),
        metadata: {
            ...baseMetadata("Observed directly from the Codex app-server item/completed notification."),
            threadId,
            turnId,
            itemId: item.id,
            itemType: item.type,
            itemLifecycle: "completed",
            ...resolveItemStatusMetadata(item),
        },
    };
}

function baseMetadata(reason: string): Record<string, unknown> {
    return {
        ...provenEvidence(reason),
        source: APP_SERVER_SOURCE,
    };
}

function resolveItemLane(item: CodexAppServerThreadItem): RuntimeIngestEvent["lane"] {
    switch (item.type) {
        case "agentMessage":
            return LANE.user;
        case "plan":
        case "reasoning":
        case "contextCompaction":
            return LANE.planning;
        case "commandExecution":
            return inferCommandSemantic(item.command).lane;
        case "fileChange":
            return LANE.implementation;
        case "mcpToolCall":
        case "collabAgentToolCall":
            return LANE.coordination;
        case "webSearch":
        case "imageView":
            return LANE.exploration;
        default:
            return LANE.implementation;
    }
}

function resolveItemStartedTitle(item: CodexAppServerThreadItem): string {
    switch (item.type) {
        case "agentMessage":
            return "Assistant message started";
        case "plan":
            return "Plan item started";
        case "reasoning":
            return "Reasoning started";
        case "commandExecution":
            return `Command started: ${item.command}`;
        case "fileChange":
            return "File change proposed";
        case "mcpToolCall":
            return `MCP call started: ${item.server}/${item.tool}`;
        default:
            return `Item started: ${humanizeItemType(item.type)}`;
    }
}

function resolveItemLifecycleBody(item: CodexAppServerThreadItem): string | undefined {
    switch (item.type) {
        case "agentMessage":
            return item.text || undefined;
        case "plan":
            return item.text || undefined;
        case "reasoning":
            return [...item.summary, ...item.content].join("\n") || undefined;
        case "commandExecution":
            return item.command;
        case "fileChange":
            return item.changes[0]?.path
                ? `Codex proposed updates for ${item.changes[0].path}.`
                : undefined;
        case "mcpToolCall":
            return `Used MCP tool ${item.server}/${item.tool}`;
        default:
            return undefined;
    }
}

function resolveItemStatusMetadata(item: CodexAppServerThreadItem): Record<string, unknown> {
    if ("status" in item && typeof item.status === "string") {
        return { itemStatus: item.status };
    }
    return {};
}

function collectFilePaths(changes: readonly CodexAppServerFileChangeItem["changes"][number][]): string[] {
    const seen = new Set<string>();
    const paths: string[] = [];

    for (const change of changes) {
        if (change.path && !seen.has(change.path)) {
            paths.push(change.path);
            seen.add(change.path);
        }
        if (change.kind.type === "update" && change.kind.move_path && !seen.has(change.kind.move_path)) {
            paths.push(change.kind.move_path);
            seen.add(change.kind.move_path);
        }
    }

    return paths;
}

function resolveFileSemanticToolName(item: CodexAppServerFileChangeItem): string {
    const firstChange = item.changes[0];
    if (!firstChange) return "FileChange";

    switch (firstChange.kind.type) {
        case "add":
            return "Create";
        case "delete":
            return "Delete";
        case "update":
            return firstChange.kind.move_path ? "Rename" : "Edit";
        default:
            return "FileChange";
    }
}

function formatStructuredPlan(plan: readonly CodexAppServerTurnPlanStep[]): string {
    return plan
        .map((entry) => `- [${humanizeStatus(entry.status)}] ${entry.step}`)
        .join("\n");
}

function humanizeItemType(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .trim();
}

function humanizeStatus(value: string): string {
    const normalized = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    if (!normalized) return value;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
