import {
    hasSessionId,
    readSessionContext,
    type ClaudeSessionContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readOptionalString,
    readString,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

export interface SessionStartPayload extends ClaudeSessionContext {
    readonly source: string;
    readonly model: string | undefined;
}

export interface SessionEndPayload extends ClaudeSessionContext {
    readonly reason: string | undefined;
}

export interface UserPromptSubmitPayload extends ClaudeSessionContext {
    readonly prompt: string;
}

export function readSessionStart(raw: JsonObject): ReaderResult<SessionStartPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            source: readString(raw, "source"),
            model: readOptionalString(raw, "model"),
        },
    };
}

export function readSessionEnd(raw: JsonObject): ReaderResult<SessionEndPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), reason: readOptionalString(raw, "reason")},
    };
}

export function readUserPromptSubmit(raw: JsonObject): ReaderResult<UserPromptSubmitPayload> {
    if (!hasSessionId(raw)) return {ok: false, reason: "missing session_id"};
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), prompt: readString(raw, "prompt")},
    };
}
