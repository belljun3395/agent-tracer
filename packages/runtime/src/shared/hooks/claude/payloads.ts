/**
 * Typed payload shapes for every Claude Code hook event this runtime handles.
 * Field names use snake_case to match https://code.claude.com/docs/en/hooks.
 *
 * All payload readers are pure and zero-throw — they return
 * `{ ok: true, value }` on success or `{ ok: false, reason }` on a missing
 * required field. Hook handlers receive the validated context or skip.
 */
import {
    readBoolean,
    type ReaderResult,
    readOptionalString,
    readRecord,
    readString,
    readStringArray,
} from "~shared/hook-runtime/validator.js";
import type {JsonObject} from "~shared/util/utils.type.js";
export interface ClaudeSessionContextBase {
    readonly payload: JsonObject;
    readonly sessionId: string;
    readonly cwd: string | undefined;
    readonly transcriptPath: string | undefined;
    readonly permissionMode: string | undefined;
    readonly agentId: string | undefined;
    readonly agentType: string | undefined;
}

export interface SessionStartPayload extends ClaudeSessionContextBase {
    readonly source: string;
    readonly model: string | undefined;
}

export interface SessionEndPayload extends ClaudeSessionContextBase {
    readonly reason: string | undefined;
}

export interface UserPromptSubmitPayload extends ClaudeSessionContextBase {
    readonly prompt: string;
}

export interface InstructionsLoadedPayload extends ClaudeSessionContextBase {
    readonly filePath: string;
    readonly memoryType: string | undefined;
    readonly loadReason: string | undefined;
    readonly globs: readonly string[];
    readonly triggerFilePath: string | undefined;
    readonly parentFilePath: string | undefined;
}

export interface ClaudeToolContextBase extends ClaudeSessionContextBase {
    readonly toolName: string;
    readonly toolInput: JsonObject;
    readonly toolUseId: string | undefined;
}

export type PreToolUsePayload = ClaudeToolContextBase;

export interface PostToolUsePayload extends ClaudeToolContextBase {
    readonly toolResponse: unknown;
}

export interface PostToolUseFailurePayload extends ClaudeToolContextBase {
    readonly error: string;
    readonly isInterrupt: boolean;
}

export interface PostToolBatchPayload extends ClaudeSessionContextBase {
    readonly toolUseIds: readonly string[];
    readonly toolCalls: readonly {readonly toolName: string; readonly toolInput: JsonObject}[];
}

export type PermissionDeniedPayload = ClaudeToolContextBase;

export interface SubagentStartPayload extends ClaudeSessionContextBase {
    readonly subagentType: string;
}

export interface SubagentStopPayload extends ClaudeSessionContextBase {
    readonly subagentType: string;
    readonly stopReason: string | undefined;
}

export interface TaskCreatedPayload extends ClaudeSessionContextBase {
    readonly taskName: string;
    readonly taskDescription: string | undefined;
}

export interface TaskCompletedPayload extends ClaudeSessionContextBase {
    readonly taskName: string;
}

export interface StopPayload extends ClaudeSessionContextBase {
    readonly stopReason: string | undefined;
    readonly lastAssistantMessage: string;
}

export interface StopFailurePayload extends ClaudeSessionContextBase {
    readonly errorType: string;
    readonly errorMessage: string | undefined;
}

export interface PreCompactPayload extends ClaudeSessionContextBase {
    readonly trigger: string;
}

export interface PostCompactPayload extends ClaudeSessionContextBase {
    readonly trigger: string;
}

export interface CwdChangedPayload extends ClaudeSessionContextBase {
    readonly oldCwd: string | undefined;
    readonly newCwd: string | undefined;
}

export interface NotificationPayload extends ClaudeSessionContextBase {
    readonly notificationType: string | undefined;
    readonly notificationMessage: string | undefined;
}

export interface ConfigChangePayload extends ClaudeSessionContextBase {
    readonly configSource: string | undefined;
}

// -----------------------------------------------------------------------------
// Readers
// -----------------------------------------------------------------------------
function readSessionBase(raw: JsonObject): Omit<ClaudeSessionContextBase, "payload"> {
    return {
        sessionId: readString(raw, "session_id"),
        cwd: readOptionalString(raw, "cwd"),
        transcriptPath: readOptionalString(raw, "transcript_path"),
        permissionMode: readOptionalString(raw, "permission_mode"),
        agentId: readOptionalString(raw, "agent_id"),
        agentType: readOptionalString(raw, "agent_type"),
    };
}

function readToolBase(raw: JsonObject): Omit<ClaudeToolContextBase, "payload"> {
    return {
        ...readSessionBase(raw),
        toolName: readString(raw, "tool_name"),
        toolInput: readRecord(raw, "tool_input"),
        toolUseId: readOptionalString(raw, "tool_use_id"),
    };
}

export function readSessionStart(raw: JsonObject): ReaderResult<SessionStartPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            source: readString(raw, "source"),
            model: readOptionalString(raw, "model"),
        },
    };
}

export function readSessionEnd(raw: JsonObject): ReaderResult<SessionEndPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            reason: readOptionalString(raw, "reason"),
        },
    };
}

export function readUserPromptSubmit(raw: JsonObject): ReaderResult<UserPromptSubmitPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            prompt: readString(raw, "prompt"),
        },
    };
}

export function readInstructionsLoaded(raw: JsonObject): ReaderResult<InstructionsLoadedPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            filePath: readString(raw, "file_path"),
            memoryType: readOptionalString(raw, "memory_type"),
            loadReason: readOptionalString(raw, "load_reason"),
            globs: readStringArray(raw, "globs"),
            triggerFilePath: readOptionalString(raw, "trigger_file_path"),
            parentFilePath: readOptionalString(raw, "parent_file_path"),
        },
    };
}

export function readPreToolUse(raw: JsonObject): ReaderResult<PreToolUsePayload> {
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

export function readPostToolUse(raw: JsonObject): ReaderResult<PostToolUsePayload> {
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

export function readPostToolUseFailure(raw: JsonObject): ReaderResult<PostToolUseFailurePayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readToolBase(raw),
            error: readString(raw, "error"),
            isInterrupt: readBoolean(raw, "is_interrupt"),
        },
    };
}

export function readPostToolBatch(raw: JsonObject): ReaderResult<PostToolBatchPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    const rawToolCalls = Array.isArray(raw["tool_calls"]) ? raw["tool_calls"] : [];
    const toolCalls = rawToolCalls.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
        const record = entry as Record<string, unknown>;
        const toolName = readString(record, "tool_name");
        if (!toolName) return [];
        return [{
            toolName,
            toolInput: readRecord(record, "tool_input"),
        }];
    });
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            toolUseIds: readStringArray(raw, "tool_use_ids"),
            toolCalls,
        },
    };
}

export function readPermissionDenied(raw: JsonObject): ReaderResult<PermissionDeniedPayload> {
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

export function readSubagentStart(raw: JsonObject): ReaderResult<SubagentStartPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    const subagentType = readOptionalString(raw, "subagent_type");
    if (!subagentType) {
        return {ok: false, reason: "missing subagent_type"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            subagentType,
        },
    };
}

export function readSubagentStop(raw: JsonObject): ReaderResult<SubagentStopPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    const subagentType = readOptionalString(raw, "subagent_type");
    if (!subagentType) {
        return {ok: false, reason: "missing subagent_type"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            subagentType,
            stopReason: readOptionalString(raw, "stop_reason"),
        },
    };
}

export function readTaskCreated(raw: JsonObject): ReaderResult<TaskCreatedPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    const taskName = readOptionalString(raw, "task_name");
    if (!taskName) {
        return {ok: false, reason: "missing task_name"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            taskName,
            taskDescription: readOptionalString(raw, "task_description"),
        },
    };
}

export function readTaskCompleted(raw: JsonObject): ReaderResult<TaskCompletedPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    const taskName = readOptionalString(raw, "task_name");
    if (!taskName) {
        return {ok: false, reason: "missing task_name"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            taskName,
        },
    };
}

export function readStop(raw: JsonObject): ReaderResult<StopPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            stopReason: readOptionalString(raw, "stop_reason"),
            lastAssistantMessage: readString(raw, "last_assistant_message"),
        },
    };
}

export function readStopFailure(raw: JsonObject): ReaderResult<StopFailurePayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            errorType: readString(raw, "error_type") || "unknown",
            errorMessage: readOptionalString(raw, "error_message"),
        },
    };
}

export function readPreCompact(raw: JsonObject): ReaderResult<PreCompactPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            trigger: readString(raw, "trigger") || "manual",
        },
    };
}

export function readPostCompact(raw: JsonObject): ReaderResult<PostCompactPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            trigger: readString(raw, "trigger") || "manual",
        },
    };
}

export function readCwdChanged(raw: JsonObject): ReaderResult<CwdChangedPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            oldCwd: readOptionalString(raw, "old_cwd"),
            newCwd: readOptionalString(raw, "new_cwd"),
        },
    };
}

export function readNotification(raw: JsonObject): ReaderResult<NotificationPayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            notificationType: readOptionalString(raw, "notification_type"),
            notificationMessage: readOptionalString(raw, "notification_message"),
        },
    };
}

export function readConfigChange(raw: JsonObject): ReaderResult<ConfigChangePayload> {
    if (!readString(raw, "session_id")) {
        return {ok: false, reason: "missing session_id"};
    }
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionBase(raw),
            configSource: readOptionalString(raw, "config_source"),
        },
    };
}
