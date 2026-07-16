import {
    readSessionContext,
    type ClaudeSessionContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readBoolean,
    readOptionalString,
    readString,
    requireSessionId,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

export interface StopPayload extends ClaudeSessionContext {
    readonly stopReason: string | undefined;
    readonly lastAssistantMessage: string;
    readonly stopHookActive: boolean;
}

export interface StopFailurePayload extends ClaudeSessionContext {
    readonly errorType: string;
    readonly errorMessage: string | undefined;
}

export interface CompactPayload extends ClaudeSessionContext {
    readonly trigger: string;
}

export function readStop(raw: JsonObject): ReaderResult<StopPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            stopReason: readOptionalString(raw, "stop_reason"),
            lastAssistantMessage: readString(raw, "last_assistant_message"),
            stopHookActive: readBoolean(raw, "stop_hook_active"),
        },
    };
}

export function readStopFailure(raw: JsonObject): ReaderResult<StopFailurePayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            errorType: readString(raw, "error_type") || "unknown",
            errorMessage: readOptionalString(raw, "error_message"),
        },
    };
}

export function readPreCompact(raw: JsonObject): ReaderResult<CompactPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), trigger: readString(raw, "trigger") || "manual"},
    };
}

export function readPostCompact(raw: JsonObject): ReaderResult<CompactPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), trigger: readString(raw, "trigger") || "manual"},
    };
}
