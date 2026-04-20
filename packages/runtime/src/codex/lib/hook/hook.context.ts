import {hookLogPayload} from "~codex/lib/hook/hook.log.js";
import type {HookSessionContext, ToolHookContext} from "~codex/lib/hook/hook.context.type.js";
import {readStdinJson} from "~codex/lib/transport/transport.js";
import {isRecord, toTrimmedString} from "~codex/util/utils.js";

/**
 * Reads the hook payload from stdin, logs it, and extracts `sessionId`.
 * Returns a typed `HookSessionContext` for use by any hook handler.
 */
export async function readHookSessionContext(hookName: string): Promise<HookSessionContext> {
    const payload = await readStdinJson();
    hookLogPayload(hookName, payload);
    const sessionId = toTrimmedString(payload.session_id);
    return {payload, sessionId};
}

/**
 * Extends `readHookSessionContext` with tool-specific fields: `toolName`, `toolInput`, and optional `toolUseId`.
 * Used by PreToolUse and PostToolUse hooks to access structured tool call data.
 */
export async function readToolHookContext(hookName: string): Promise<ToolHookContext> {
    const ctx = await readHookSessionContext(hookName);
    const toolName = toTrimmedString(ctx.payload.tool_name);
    const toolInput = isRecord(ctx.payload.tool_input) ? ctx.payload.tool_input : {};
    const toolUseId = toTrimmedString(ctx.payload.tool_use_id) || undefined;
    return {
        ...ctx,
        toolName,
        toolInput,
        ...(toolUseId ? {toolUseId} : {}),
    };
}
