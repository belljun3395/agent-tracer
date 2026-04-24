import {hookLogPayload} from "~codex/lib/hook/hook.log.js";
import type {HookSessionContext, ToolHookContext, TurnHookContext} from "~codex/lib/hook/hook.context.type.js";
import {readStdinJson} from "~codex/lib/transport/transport.js";
import {isRecord, toTrimmedString} from "~codex/util/utils.js";

function optionalTrimmed(value: unknown): string | undefined {
    const next = toTrimmedString(value);
    return next || undefined;
}

/**
 * Reads the hook payload from stdin, logs it, and extracts the session-level
 * context documented by https://developers.openai.com/codex/hooks — every
 * event includes `session_id`, `cwd`, `hook_event_name`, and `model`.
 */
export async function readHookSessionContext(hookName: string): Promise<HookSessionContext> {
    const payload = await readStdinJson();
    hookLogPayload(hookName, payload);
    const sessionId = toTrimmedString(payload.session_id);
    const model = optionalTrimmed(payload.model);
    const cwd = optionalTrimmed(payload.cwd);
    const transcriptPath = optionalTrimmed(payload.transcript_path);
    return {
        payload,
        sessionId,
        ...(model ? {model} : {}),
        ...(cwd ? {cwd} : {}),
        ...(transcriptPath ? {transcriptPath} : {}),
    };
}

/**
 * Reads turn-scoped events (PreToolUse, PermissionRequest, PostToolUse,
 * UserPromptSubmit, Stop) which add `turn_id` per the Codex docs.
 */
export async function readTurnHookContext(hookName: string): Promise<TurnHookContext> {
    const ctx = await readHookSessionContext(hookName);
    const turnId = optionalTrimmed(ctx.payload.turn_id);
    return {
        ...ctx,
        ...(turnId ? {turnId} : {}),
    };
}

/**
 * Extends `readTurnHookContext` with tool-specific fields: `toolName`,
 * `toolInput`, and optional `toolUseId`. Used by PreToolUse, PermissionRequest,
 * and PostToolUse hooks.
 */
export async function readToolHookContext(hookName: string): Promise<ToolHookContext> {
    const ctx = await readTurnHookContext(hookName);
    const toolName = toTrimmedString(ctx.payload.tool_name);
    const toolInput = isRecord(ctx.payload.tool_input) ? ctx.payload.tool_input : {};
    const toolUseId = optionalTrimmed(ctx.payload.tool_use_id);
    return {
        ...ctx,
        toolName,
        toolInput,
        ...(toolUseId ? {toolUseId} : {}),
    };
}
