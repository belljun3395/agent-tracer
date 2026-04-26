/**
 * Shared helpers for the per-tool PostToolUse handlers.
 *
 * Each handler follows the same shape:
 *   1. Read + validate the PostToolUse payload (via readPostToolUse).
 *   2. Resolve the event session context (handles subagents).
 *   3. Build tool-specific metadata + semantics.
 *   4. Post a tagged event to the monitor.
 *
 * This file centralizes the read/resolve boilerplate so each hook file
 * can focus on the tool-specific logic only.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPostToolUse, type PostToolUsePayload} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import type {RuntimeSessionEnsureResult} from "~shared/hook-runtime/transport.js";

export interface PostToolUseHandlerArgs {
    readonly payload: PostToolUsePayload;
    readonly ids: RuntimeSessionEnsureResult;
}

/**
 * Wraps the PostToolUse hook boilerplate: validates the payload, resolves
 * the (sub-)agent session context, and invokes the tool-specific handler.
 * Hook scripts should call this with their PostToolUse-matcher name and
 * a handler that builds+posts the event.
 */
export async function runPostToolUseHook(
    matcherName: string,
    handler: (args: PostToolUseHandlerArgs) => Promise<void>,
): Promise<void> {
    await runHook(`PostToolUse/${matcherName}`, {
        logger: claudeHookRuntime.logger,
        parse: readPostToolUse,
        handler: async (payload) => {
            if (!payload.sessionId || !payload.toolName) return;
            const ids = await resolveEventSessionIds(
                payload.sessionId,
                payload.agentId,
                payload.agentType,
            );
            await handler({payload, ids});
        },
    });
}

export const postTaggedEvent = claudeHookRuntime.transport.postTaggedEvent;
export const postTaggedEvents = claudeHookRuntime.transport.postTaggedEvents;
