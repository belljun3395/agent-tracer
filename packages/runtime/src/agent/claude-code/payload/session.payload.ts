import {
    readSessionContext,
    type ClaudeSessionContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readOptionalString,
    readString,
    requireSessionId,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

/** Claude Code가 SessionEnd로 싣는 알려진 종료 사유 값이며 그 외 값은 런타임 종료로 본다. */
export const SESSION_END_REASON = {
    clear: "clear",
    promptInputExit: "prompt_input_exit",
} as const;
export type SessionEndReason = (typeof SESSION_END_REASON)[keyof typeof SESSION_END_REASON];

/** Claude Code가 SessionStart로 싣는 계기 값이며 clear는 태스크 경계를 여닫는다. */
export const SESSION_START_SOURCE = {
    startup: "startup",
    resume: "resume",
    clear: "clear",
    compact: "compact",
} as const;
export type SessionStartSource = (typeof SESSION_START_SOURCE)[keyof typeof SESSION_START_SOURCE];

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
    const missing = requireSessionId(raw);
    if (missing) return missing;
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
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), reason: readOptionalString(raw, "reason")},
    };
}

export function readUserPromptSubmit(raw: JsonObject): ReaderResult<UserPromptSubmitPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), prompt: readString(raw, "prompt")},
    };
}
