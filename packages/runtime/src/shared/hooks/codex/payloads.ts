/**
 * Typed payload shapes for every Codex CLI hook event this runtime handles.
 * Field names use snake_case to match https://developers.openai.com/codex/hooks.
 *
 * Per the Codex docs, turn-scoped events (PreToolUse, PermissionRequest,
 * PostToolUse, UserPromptSubmit, Stop) include a `turn_id` that is absent
 * from SessionStart. All events carry `session_id`, `cwd`, `hook_event_name`,
 * and `model`.
 */
import {
    readBoolean,
    readOptionalString,
    readRecord,
    readString,
    type ReaderResult,
} from "~shared/hook-runtime/validator.js";
import type {JsonObject} from "~shared/util/utils.type.js";

export interface CodexSessionContextBase {
    readonly payload: JsonObject;
    readonly sessionId: string;
    readonly cwd: string | undefined;
    readonly transcriptPath: string | undefined;
    readonly model: string | undefined;
}

export interface CodexTurnContextBase extends CodexSessionContextBase {
    readonly turnId: string | undefined;
}

export interface CodexToolContextBase extends CodexTurnContextBase {
    readonly toolName: string;
    readonly toolInput: JsonObject;
    readonly toolUseId: string | undefined;
}

export interface CodexSessionStartPayload extends CodexSessionContextBase {
    readonly source: string | undefined;
}

export type CodexPreToolUsePayload = CodexToolContextBase;

export interface CodexPermissionRequestPayload extends CodexToolContextBase {
    readonly description: string | undefined;
}

export interface CodexPostToolUsePayload extends CodexToolContextBase {
    readonly toolResponse: unknown;
}

export interface CodexUserPromptSubmitPayload extends CodexTurnContextBase {
    readonly prompt: string;
}

export interface CodexStopPayload extends CodexTurnContextBase {
    readonly stopHookActive: boolean;
    readonly lastAssistantMessage: string;
}

function readSessionBase(raw: JsonObject): Omit<CodexSessionContextBase, "payload"> {
    return {
        sessionId: readString(raw, "session_id"),
        cwd: readOptionalString(raw, "cwd"),
        transcriptPath: readOptionalString(raw, "transcript_path"),
        model: readOptionalString(raw, "model"),
    };
}

function readTurnBase(raw: JsonObject): Omit<CodexTurnContextBase, "payload"> {
    return {
        ...readSessionBase(raw),
        turnId: readOptionalString(raw, "turn_id"),
    };
}

function readToolBase(raw: JsonObject): Omit<CodexToolContextBase, "payload"> {
    return {
        ...readTurnBase(raw),
        toolName: readString(raw, "tool_name"),
        toolInput: readRecord(raw, "tool_input"),
        toolUseId: readOptionalString(raw, "tool_use_id"),
    };
}

export function readCodexSessionStart(raw: JsonObject): ReaderResult<CodexSessionStartPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            source: readOptionalString(raw, "source"),
        },
    };
}

export function readCodexPreToolUse(raw: JsonObject): ReaderResult<CodexPreToolUsePayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readToolBase(raw),
        },
    };
}

export function readCodexPermissionRequest(raw: JsonObject): ReaderResult<CodexPermissionRequestPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    const toolInput = readRecord(raw, "tool_input");
    return {
        ok: true,
        value: {
            payload: raw,
            ...readToolBase(raw),
            description: readOptionalString(toolInput, "description"),
        },
    };
}

export function readCodexPostToolUse(raw: JsonObject): ReaderResult<CodexPostToolUsePayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readToolBase(raw),
            toolResponse: raw["tool_response"],
        },
    };
}

export function readCodexUserPromptSubmit(raw: JsonObject): ReaderResult<CodexUserPromptSubmitPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readTurnBase(raw),
            prompt: readString(raw, "prompt"),
        },
    };
}

export function readCodexStop(raw: JsonObject): ReaderResult<CodexStopPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readTurnBase(raw),
            stopHookActive: readBoolean(raw, "stop_hook_active"),
            lastAssistantMessage: readString(raw, "last_assistant_message"),
        },
    };
}
