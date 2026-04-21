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
import type {RuntimeSessionEnsureResult} from "~shared/transport/transport.js";
import {ensureRuntimeSession} from "~claude-code/hooks/lib/transport/transport.js";


/**
 * Creates or resumes a child monitor session for a background agent. Links the
 * child task to the parent session. Returns `{ taskId, sessionId }` for the
 * child task.
 */
export async function resolveBackgroundSessionIds(
    parentRuntimeSessionId: string,
    childRuntimeSessionId: string,
    childTitle: string,
    parentIds?: Pick<RuntimeSessionEnsureResult, "taskId" | "sessionId">
): Promise<RuntimeSessionEnsureResult> {
    const resolvedParentIds = parentIds ?? await ensureRuntimeSession(parentRuntimeSessionId);
    return ensureRuntimeSession(childRuntimeSessionId, childTitle, {
        parentTaskId: resolvedParentIds.taskId,
        parentSessionId: resolvedParentIds.sessionId
    });
}

/**
 * Creates a virtual monitor session using a synthetic ID (`"sub--{agentId}"`) to
 * isolate the subagent's events from the parent session. Returns `{ taskId, sessionId }`
 * for the virtual session.
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
 * Dispatcher — routes to `resolveSubagentSessionIds` when `agentId` is present,
 * otherwise ensures and returns the standard session. Used by hook handlers that
 * must work for both main-session and subagent contexts.
 */
export async function resolveEventSessionIds(
    sessionId: string,
    agentId?: string,
    agentType?: string
): Promise<RuntimeSessionEnsureResult> {
    if (agentId) {
        return resolveSubagentSessionIds(sessionId, agentId, agentType);
    }
    return ensureRuntimeSession(sessionId);
}
