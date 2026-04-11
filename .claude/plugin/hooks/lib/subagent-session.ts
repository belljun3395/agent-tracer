/**
 * Subagent-aware session resolution.
 *
 * Claude Code sends the same session_id (parent's) to ALL hooks — including
 * hooks that fire inside a subagent. The agent_id field is the only discriminator.
 *
 * This module provides:
 *   resolveSubagentSessionIds — creates/resolves a virtual monitor session keyed
 *                               by "sub--{agent_id}" so subagent events land on a
 *                               separate background child task.
 *   resolveEventSessionIds    — universal dispatcher: uses the virtual path when
 *                               agent_id is present, falls back to resolveSessionIds
 *                               for ordinary (non-subagent) hooks.
 *
 * Virtual session ID format: "sub--{agent_id}"
 *   • Avoids collisions with real UUID session IDs.
 *   • Compatible with the FS session cache (no special characters that cause
 *     issues on POSIX file systems).
 *   • Cleaned up by SubagentStop.ts via deleteCachedSessionResult.
 */
import { getCachedSessionResult, cacheSessionResult } from "./session-cache.js";
import { resolveSessionIds } from "./session.js";
import { ensureRuntimeSession } from "./transport.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";

/**
 * Resolve (or create) a monitor task/session for a subagent identified by agent_id.
 *
 * On cache miss, resolves the parent session first to obtain parentTaskId, then
 * calls ensureRuntimeSession with the virtual session ID so the server creates a
 * background child task linked to the parent.
 *
 * Idempotent: concurrent calls for the same agent_id are safe because
 * ensureRuntimeSession is idempotent on the server side.
 */
export async function resolveSubagentSessionIds(
    parentSessionId: string,
    agentId: string,
    agentType?: string
): Promise<RuntimeSessionEnsureResult> {
    const virtualId = `sub--${agentId}`;

    const cached = getCachedSessionResult(virtualId);
    if (cached) return cached;

    const parentIds = await resolveSessionIds(parentSessionId);
    const title = agentType ? `Subagent: ${agentType}` : `Subagent: ${agentId}`;

    const fresh = await ensureRuntimeSession(virtualId, title, {
        parentTaskId: parentIds.taskId,
        parentSessionId: parentIds.sessionId
    });
    cacheSessionResult(virtualId, fresh);
    return fresh;
}

/**
 * Universal session resolver for hook handlers.
 *
 * When agent_id is present (hook fired inside a subagent), routes to
 * resolveSubagentSessionIds so events record on the child task.
 * Otherwise falls back to the standard resolveSessionIds.
 */
export async function resolveEventSessionIds(
    sessionId: string,
    agentId?: string,
    agentType?: string
): Promise<RuntimeSessionEnsureResult> {
    if (agentId) {
        return resolveSubagentSessionIds(sessionId, agentId, agentType);
    }
    return resolveSessionIds(sessionId);
}
