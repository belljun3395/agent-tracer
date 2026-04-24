import {hookLogPayload} from "~claude-code/hooks/lib/hook/hook.log.js";
import type {HookSessionContext, ToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.type.js";
import {getAgentContext, getSessionId, getToolInput, getToolName, getToolUseId} from "~claude-code/hooks/util/payload.js";
import {readStdinJson} from "~claude-code/hooks/lib/transport/transport.js";
import {toOptionalTrimmedString} from "~claude-code/hooks/util/utils.js";

/**
 * Reads the hook payload from stdin, logs it, and extracts the session-level
 * context documented by https://code.claude.com/docs/en/hooks (session_id,
 * agent_id, agent_type, model, permission_mode, transcript_path, cwd).
 */
export async function readHookSessionContext(hookName: string): Promise<HookSessionContext> {
    const payload = await readStdinJson();
    hookLogPayload(hookName, payload);
    const sessionId = getSessionId(payload);
    const {agentId, agentType} = getAgentContext(payload);
    const model = toOptionalTrimmedString(payload["model"]);
    const permissionMode = toOptionalTrimmedString(payload["permission_mode"]);
    const transcriptPath = toOptionalTrimmedString(payload["transcript_path"]);
    const cwd = toOptionalTrimmedString(payload["cwd"]);
    return {
        payload,
        sessionId,
        ...(agentId ? {agentId} : {}),
        ...(agentType ? {agentType} : {}),
        ...(model ? {model} : {}),
        ...(permissionMode ? {permissionMode} : {}),
        ...(transcriptPath ? {transcriptPath} : {}),
        ...(cwd ? {cwd} : {}),
    };
}

/**
 * Extends `readHookSessionContext` with tool-specific fields: `toolName`,
 * `toolInput`, and optional `toolUseId`. Used by PreToolUse and PostToolUse
 * hooks to access structured tool call data.
 */
export async function readToolHookContext(hookName: string): Promise<ToolHookContext> {
    const ctx = await readHookSessionContext(hookName);
    const toolName = getToolName(ctx.payload);
    const toolInput = getToolInput(ctx.payload);
    const toolUseId = getToolUseId(ctx.payload);
    return {
        ...ctx,
        toolName,
        toolInput,
        ...(toolUseId ? {toolUseId} : {}),
    };
}
