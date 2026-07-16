import {
    readSessionContext,
    type ClaudeSessionContext,
} from "~runtime/agent/claude-code/payload/context.payload.js";
import {
    readOptionalString,
    readString,
    readStringArray,
    requireSessionId,
    type ReaderResult,
} from "~runtime/agent/claude-code/payload/field.payload.js";
import type {JsonObject} from "~runtime/support/json.js";

export interface InstructionsLoadedPayload extends ClaudeSessionContext {
    readonly filePath: string;
    readonly memoryType: string | undefined;
    readonly loadReason: string | undefined;
    readonly globs: readonly string[];
}

export interface CwdChangedPayload extends ClaudeSessionContext {
    readonly oldCwd: string | undefined;
    readonly newCwd: string | undefined;
}

export interface NotificationPayload extends ClaudeSessionContext {
    readonly notificationType: string | undefined;
    readonly notificationMessage: string | undefined;
}

export interface ConfigChangePayload extends ClaudeSessionContext {
    readonly configSource: string | undefined;
}

export interface UserPromptExpansionPayload extends ClaudeSessionContext {
    readonly expansionType: string;
    readonly commandName: string;
    readonly commandArgs: string | undefined;
    readonly commandSource: string | undefined;
    readonly prompt: string | undefined;
}

export interface FileChangedPayload extends ClaudeSessionContext {
    readonly filePath: string;
}

export interface WorktreePayload extends ClaudeSessionContext {
    readonly worktreePath: string;
}

export interface SetupPayload extends ClaudeSessionContext {
    readonly trigger: string;
}

export function readInstructionsLoaded(raw: JsonObject): ReaderResult<InstructionsLoadedPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    const filePath = readString(raw, "file_path");
    if (!filePath) return {ok: false, reason: "missing file_path"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            filePath,
            memoryType: readOptionalString(raw, "memory_type"),
            loadReason: readOptionalString(raw, "load_reason"),
            globs: readStringArray(raw, "globs"),
        },
    };
}

export function readCwdChanged(raw: JsonObject): ReaderResult<CwdChangedPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            oldCwd: readOptionalString(raw, "old_cwd"),
            newCwd: readOptionalString(raw, "new_cwd"),
        },
    };
}

export function readNotification(raw: JsonObject): ReaderResult<NotificationPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            notificationType: readOptionalString(raw, "notification_type"),
            notificationMessage: readOptionalString(raw, "notification_message"),
        },
    };
}

export function readConfigChange(raw: JsonObject): ReaderResult<ConfigChangePayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            configSource: readOptionalString(raw, "config_source"),
        },
    };
}

export function readUserPromptExpansion(raw: JsonObject): ReaderResult<UserPromptExpansionPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    const commandName = readString(raw, "command_name");
    if (!commandName) return {ok: false, reason: "missing command_name"};
    return {
        ok: true,
        value: {
            payload: raw,
            ...readSessionContext(raw),
            expansionType: readString(raw, "expansion_type") || "slash_command",
            commandName,
            commandArgs: readOptionalString(raw, "command_args"),
            commandSource: readOptionalString(raw, "command_source"),
            prompt: readOptionalString(raw, "prompt"),
        },
    };
}

export function readFileChanged(raw: JsonObject): ReaderResult<FileChangedPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    const filePath = readString(raw, "file_path");
    if (!filePath) return {ok: false, reason: "missing file_path"};
    return {ok: true, value: {payload: raw, ...readSessionContext(raw), filePath}};
}

export function readWorktree(raw: JsonObject): ReaderResult<WorktreePayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    const worktreePath = readString(raw, "worktree_path");
    if (!worktreePath) return {ok: false, reason: "missing worktree_path"};
    return {ok: true, value: {payload: raw, ...readSessionContext(raw), worktreePath}};
}

export function readSetup(raw: JsonObject): ReaderResult<SetupPayload> {
    const missing = requireSessionId(raw);
    if (missing) return missing;
    return {
        ok: true,
        value: {payload: raw, ...readSessionContext(raw), trigger: readString(raw, "trigger") || "init"},
    };
}
