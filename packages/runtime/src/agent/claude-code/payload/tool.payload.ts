import {
    hasSessionId,
    readSessionContext,
    readToolContext,
    type ClaudeSessionContext,
    type ClaudeToolContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readBoolean,
    readRecord,
    readString,
    readStringArray,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

export type PreToolUsePayload = ClaudeToolContext;

export interface PostToolUsePayload extends ClaudeToolContext {
    readonly toolResponse: unknown;
}

export interface PostToolUseFailurePayload extends ClaudeToolContext {
    readonly error: string;
    readonly isInterrupt: boolean;
}

export interface PostToolBatchPayload extends ClaudeSessionContext {
    readonly toolUseIds: readonly string[];
    readonly toolCalls: readonly {readonly toolName: string; readonly toolInput: JsonObject}[];
}

export type PermissionDeniedPayload = ClaudeToolContext;

export interface PermissionRequestPayload extends ClaudeToolContext {
    readonly suggestionCount: number;
}

export function readPreToolUse(raw: JsonObject): ReaderResult<PreToolUsePayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {ok: true, value: {payload: raw, ...readToolContext(raw)}};
}

export function readPostToolUse(raw: JsonObject): ReaderResult<PostToolUsePayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {
        ok: true,
        value: {payload: raw, ...readToolContext(raw), toolResponse: raw["tool_response"]},
    };
}

export function readPostToolUseFailure(raw: JsonObject): ReaderResult<PostToolUseFailurePayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...readToolContext(raw),
            error: readString(raw, "error"),
            isInterrupt: readBoolean(raw, "is_interrupt"),
        },
    };
}

export function readPostToolBatch(raw: JsonObject): ReaderResult<PostToolBatchPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    const rawCalls = Array.isArray(raw["tool_calls"]) ? raw["tool_calls"] : [];
    const toolCalls = rawCalls.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
        const record = entry as Record<string, unknown>;
        const toolName = readString(record, "tool_name");
        if (!toolName) return [];
        return [{toolName, toolInput: readRecord(record, "tool_input")}];
    });
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            toolUseIds: readStringArray(raw, "tool_use_ids"),
            toolCalls,
        },
    };
}

export function readPermissionDenied(raw: JsonObject): ReaderResult<PermissionDeniedPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {ok: true, value: {payload: raw, ...readToolContext(raw)}};
}

export function readPermissionRequest(raw: JsonObject): ReaderResult<PermissionRequestPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    const suggestions = Array.isArray(raw["permission_suggestions"]) ? raw["permission_suggestions"] : [];
    return {
        ok: true,
        value: {payload: raw, ...readToolContext(raw), suggestionCount: suggestions.length},
    };
}
