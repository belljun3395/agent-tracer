/**
 * Transcript entry → IngestEvent mapping.
 *
 * The Claude Code session transcript (~/.claude/projects/<slug>/<sid>.jsonl)
 * carries information hooks cannot see directly: model thinking blocks,
 * intermediate narration text between tool calls, and system-injected
 * attachments (task_reminder, plan_mode, skill_listing, deferred_tools_delta,
 * mcp_instructions_delta, nested_memory).
 *
 * This module is a pure mapping layer. Tailing/cursor I/O lives in
 * transcript-tail.ts. Event posting lives in the Stop/SubagentStop hooks.
 *
 * Deterministic messageId via SHA-1 keeps replays idempotent: the same
 * transcript entry + content index produces the same ID across runs.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { LANE } from "../util/lane.js";
import type { JsonObject } from "../util/utils.js";
import { ellipsize, isRecord, toTrimmedString } from "../util/utils.js";

// ---------- Transcript entry types ----------

export interface TranscriptUsage {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}

export interface TranscriptAssistantContentBlock {
    type?: string;
    thinking?: string;
    signature?: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
}

export interface TranscriptAssistantMessage {
    role?: string;
    stop_reason?: string;
    usage?: TranscriptUsage;
    content?: TranscriptAssistantContentBlock[];
    id?: string;
    model?: string;
}

export interface TranscriptEntry {
    type?: string;
    uuid?: string;
    parentUuid?: string | null;
    timestamp?: string;
    sessionId?: string;
    requestId?: string;
    message?: TranscriptAssistantMessage;
    attachment?: JsonObject;
    subtype?: string;
    isSidechain?: boolean;
}

// ---------- Ingest event shape ----------

export interface IngestEvent {
    kind: string;
    taskId: string;
    sessionId: string;
    messageId: string;
    source: string;
    title?: string;
    body?: string;
    lane?: string;
    metadata?: JsonObject;
    createdAt?: string;
}

export interface EventIds {
    taskId: string;
    sessionId: string;
}

const SOURCE = "claude-transcript";

// ---------- Helpers ----------

/** Deterministic messageId so duplicate emits (same transcript, same entry) are idempotent. */
export function makeTranscriptEventId(
    sessionId: string,
    entryUuid: string,
    contentIndex: number
): string {
    return crypto
        .createHash("sha1")
        .update(`transcript:${sessionId}:${entryUuid}:${contentIndex}`)
        .digest("hex")
        .slice(0, 32);
}

/** Parse a JSONL buffer into TranscriptEntry records. Silently skips malformed lines. */
export function parseJsonlLines(content: string): TranscriptEntry[] {
    if (!content) return [];
    const lines = content.split("\n");
    const out: TranscriptEntry[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            out.push(JSON.parse(trimmed) as TranscriptEntry);
        } catch {
            // Skip malformed line
        }
    }
    return out;
}

/** Return the slice of `entries` that appear strictly after `lastUuid`. */
export function findNewSince(
    entries: TranscriptEntry[],
    lastUuid: string | null
): TranscriptEntry[] {
    if (!lastUuid) return entries.filter((e) => !!e.uuid);
    const idx = entries.findIndex((e) => e.uuid === lastUuid);
    if (idx < 0) return entries.filter((e) => !!e.uuid);
    return entries.slice(idx + 1).filter((e) => !!e.uuid);
}

/** Read the last assistant entry from a transcript (used by Stop.ts for usage/stop_reason). */
export function readLastAssistantEntry(transcriptPath: string): TranscriptEntry | undefined {
    try {
        const content = fs.readFileSync(transcriptPath, "utf8");
        const lines = content.trimEnd().split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i]?.trim();
            if (!line) continue;
            try {
                const entry = JSON.parse(line) as TranscriptEntry;
                if (entry.message?.role === "assistant") return entry;
            } catch {
                continue;
            }
        }
    } catch {
        /* transcript not readable — caller falls back gracefully */
    }
    return undefined;
}

// ---------- Mapping ----------

function toJsonObject(value: unknown): JsonObject | undefined {
    return isRecord(value) ? value : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out = value.filter((v): v is string => typeof v === "string");
    return out.length > 0 ? out : undefined;
}

interface AssistantEmitContext {
    entry: TranscriptEntry;
    ids: EventIds;
    hasToolUseInMessage: boolean;
}

function mapAssistantContentBlock(
    block: TranscriptAssistantContentBlock,
    contentIndex: number,
    ctx: AssistantEmitContext
): IngestEvent | null {
    const entry = ctx.entry;
    const uuid = entry.uuid;
    if (!uuid) return null;

    const baseMeta: JsonObject = {
        source: SOURCE,
        assistantUuid: uuid,
        contentIndex,
        ...(entry.parentUuid ? { parentUuid: entry.parentUuid } : {}),
        ...(entry.requestId ? { requestId: entry.requestId } : {}),
        ...(entry.message?.model ? { model: entry.message.model } : {}),
        ...(entry.message?.id ? { messageId: entry.message.id } : {})
    };

    if (block.type === "thinking") {
        const text = toTrimmedString(block.thinking);
        const signatureLength = typeof block.signature === "string" ? block.signature.length : 0;
        if (!text && signatureLength === 0) return null;
        const redacted = !text && signatureLength > 0;
        const body = redacted ? "[redacted thinking]" : text;
        const title = redacted ? "Thinking (redacted)" : ellipsize(text, 120);
        const meta: JsonObject = redacted
            ? { ...baseMeta, redacted: true, signatureLength }
            : baseMeta;
        return {
            kind: "thought.logged",
            taskId: ctx.ids.taskId,
            sessionId: ctx.ids.sessionId,
            messageId: makeTranscriptEventId(entry.sessionId ?? ctx.ids.sessionId, uuid, contentIndex),
            source: SOURCE,
            title,
            body,
            metadata: meta,
            ...(entry.timestamp ? { createdAt: entry.timestamp } : {})
        };
    }

    if (block.type === "text") {
        const text = toTrimmedString(block.text);
        if (!text) return null;
        // Only emit intermediate narration (text that coexists with tool_use in the
        // same assistant message). The final end-of-turn text is already posted by
        // Stop.ts as the primary assistant.response event.
        if (!ctx.hasToolUseInMessage) return null;
        return {
            kind: "assistant.response",
            taskId: ctx.ids.taskId,
            sessionId: ctx.ids.sessionId,
            messageId: makeTranscriptEventId(entry.sessionId ?? ctx.ids.sessionId, uuid, contentIndex),
            source: SOURCE,
            title: ellipsize(text, 120),
            body: text,
            metadata: {
                ...baseMeta,
                phase: "intermediate",
                stopReason: entry.message?.stop_reason ?? "tool_use"
            },
            ...(entry.timestamp ? { createdAt: entry.timestamp } : {})
        };
    }

    return null;
}

function mapAttachmentEntry(
    entry: TranscriptEntry,
    ids: EventIds
): IngestEvent | null {
    const attachment = entry.attachment;
    const uuid = entry.uuid;
    if (!uuid || !isRecord(attachment)) return null;

    const attachmentType = toTrimmedString(attachment.type);
    if (!attachmentType) return null;

    const commonMeta: JsonObject = {
        source: SOURCE,
        assistantUuid: uuid,
        attachmentType,
        ...(entry.parentUuid ? { parentUuid: entry.parentUuid } : {})
    };

    const eventBase = {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        messageId: makeTranscriptEventId(entry.sessionId ?? ids.sessionId, uuid, 0),
        source: SOURCE,
        ...(entry.timestamp ? { createdAt: entry.timestamp } : {})
    } as const;

    switch (attachmentType) {
        case "task_reminder": {
            const itemCount = typeof attachment.itemCount === "number" ? attachment.itemCount : undefined;
            const content = attachment.content;
            return {
                ...eventBase,
                kind: "context.saved",
                lane: LANE.planning,
                title: `Task reminder${itemCount != null ? ` (${itemCount})` : ""}`,
                metadata: {
                    ...commonMeta,
                    ...(itemCount != null ? { itemCount } : {}),
                    ...(content !== undefined ? { content } : {})
                }
            };
        }
        case "plan_mode": {
            const planExists = Boolean(attachment.planExists);
            const planFilePath = toTrimmedString(attachment.planFilePath);
            return {
                ...eventBase,
                kind: "context.saved",
                lane: LANE.planning,
                title: planExists ? "Plan mode (plan exists)" : "Plan mode",
                metadata: {
                    ...commonMeta,
                    planExists,
                    ...(planFilePath ? { planFilePath } : {}),
                    ...(typeof attachment.isSubAgent === "boolean" ? { isSubAgent: attachment.isSubAgent } : {}),
                    ...(typeof attachment.reminderType === "string" ? { reminderType: attachment.reminderType } : {})
                }
            };
        }
        case "skill_listing": {
            const content = toTrimmedString(attachment.content);
            const skillCount = typeof attachment.skillCount === "number" ? attachment.skillCount : undefined;
            const isInitial = typeof attachment.isInitial === "boolean" ? attachment.isInitial : undefined;
            return {
                ...eventBase,
                kind: "instructions.loaded",
                title: `Skill listing${skillCount != null ? ` (${skillCount})` : ""}`,
                ...(content ? { body: ellipsize(content, 4000) } : {}),
                metadata: {
                    ...commonMeta,
                    ...(skillCount != null ? { skillCount } : {}),
                    ...(isInitial != null ? { isInitial } : {})
                }
            };
        }
        case "deferred_tools_delta": {
            const addedNames = toStringArray(attachment.addedNames);
            const removedNames = toStringArray(attachment.removedNames);
            const addedCount = addedNames?.length ?? 0;
            const removedCount = removedNames?.length ?? 0;
            return {
                ...eventBase,
                kind: "instructions.loaded",
                title: `Deferred tools delta (+${addedCount} / -${removedCount})`,
                metadata: {
                    ...commonMeta,
                    ...(addedNames ? { addedNames } : {}),
                    ...(removedNames ? { removedNames } : {})
                }
            };
        }
        case "mcp_instructions_delta": {
            const addedNames = toStringArray(attachment.addedNames);
            const removedNames = toStringArray(attachment.removedNames);
            const addedBlocks = toStringArray(attachment.addedBlocks);
            return {
                ...eventBase,
                kind: "instructions.loaded",
                title: `MCP instructions delta (+${addedNames?.length ?? 0} / -${removedNames?.length ?? 0})`,
                metadata: {
                    ...commonMeta,
                    ...(addedNames ? { addedNames } : {}),
                    ...(removedNames ? { removedNames } : {}),
                    ...(addedBlocks ? { addedBlocks } : {})
                }
            };
        }
        case "nested_memory": {
            const path = toTrimmedString(attachment.path);
            const nested = toJsonObject(attachment.content);
            const innerContent = nested ? toTrimmedString(nested.content) : "";
            const displayPath = toTrimmedString(attachment.displayPath) || path;
            return {
                ...eventBase,
                kind: "context.saved",
                lane: LANE.planning,
                title: `Nested memory: ${displayPath || "(unknown)"}`,
                ...(innerContent ? { body: ellipsize(innerContent, 4000) } : {}),
                metadata: {
                    ...commonMeta,
                    ...(path ? { path } : {}),
                    ...(displayPath ? { displayPath } : {}),
                    ...(nested?.type ? { memoryType: nested.type } : {})
                }
            };
        }
        default:
            return null;
    }
}

/** Convert a batch of new transcript entries into IngestEvent records. */
export function buildEventsFromEntries(
    entries: TranscriptEntry[],
    ids: EventIds
): IngestEvent[] {
    const events: IngestEvent[] = [];

    for (const entry of entries) {
        if (!entry.uuid) continue;

        if (entry.type === "assistant" && entry.message?.role === "assistant") {
            const content = entry.message.content ?? [];
            const hasToolUseInMessage = content.some((b) => b.type === "tool_use");
            const ctx: AssistantEmitContext = { entry, ids, hasToolUseInMessage };
            content.forEach((block, idx) => {
                const event = mapAssistantContentBlock(block, idx, ctx);
                if (event) events.push(event);
            });
            continue;
        }

        if (entry.type === "attachment") {
            const event = mapAttachmentEntry(entry, ids);
            if (event) events.push(event);
            continue;
        }
        // user/tool_result and system/local_command/permission-mode intentionally skipped.
    }

    return events;
}
