/**
 * Subagent-aware session resolution.
 *
 * Claude Code sends the same session_id (parent's) to ALL hooks — including
 * hooks that fire inside a subagent. The agent_id field is the only discriminator.
 *
 * This module provides:
 *   resolveBackgroundSessionIds — creates/resolves a child runtime session that
 *                                 should be linked to the parent as a background task
 *   resolveSubagentSessionIds — creates/resolves a virtual monitor session keyed
 *                               by "sub--{agent_id}" so subagent events land on a
 *                               separate background child task.
 *   resolveEventSessionIds    — universal dispatcher: uses the virtual path when
 *                               agent_id is present, falls back to resolveSessionIds
 *                               for ordinary (non-subagent) hooks.
 *
 * Virtual session ID format: "sub--{agent_id}"
 *   • Avoids collisions with real UUID session IDs.
 *   • Stable across hook invocations so server-side idempotent ensure dedupes.
 *
 * Phase 6 removed the on-disk session-result cache; every resolution now calls
 * `/api/runtime-session-ensure` directly. The server's use case is idempotent on
 * `runtimeSessionId`, so repeated calls return the same `(taskId, sessionId)`.
 */
import { resolveSessionIds } from "./session.js";
import { ensureRuntimeSession } from "./transport.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";

export async function resolveBackgroundSessionIds(
    parentRuntimeSessionId: string,
    childRuntimeSessionId: string,
    childTitle: string,
    parentIds?: Pick<RuntimeSessionEnsureResult, "taskId" | "sessionId">
): Promise<RuntimeSessionEnsureResult> {
    const resolvedParentIds = parentIds ?? await resolveSessionIds(parentRuntimeSessionId);
    return ensureRuntimeSession(childRuntimeSessionId, childTitle, {
        parentTaskId: resolvedParentIds.taskId,
        parentSessionId: resolvedParentIds.sessionId
    });
}

/**
 * Resolve (or create) a monitor task/session for a subagent identified by agent_id.
 *
 * Resolves the parent session first to obtain parentTaskId, then calls
 * ensureRuntimeSession with the virtual session ID so the server creates a
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
    const title = agentType ? `Subagent: ${agentType}` : `Subagent: ${agentId}`;
    return resolveBackgroundSessionIds(parentSessionId, virtualId, title);
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
