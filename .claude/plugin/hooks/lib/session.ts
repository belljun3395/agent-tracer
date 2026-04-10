/**
 * Session resolution with FS-backed cache.
 *
 * Encapsulates the single repeated pattern across all hook handlers:
 *   cache hit  → return cached RuntimeSessionEnsureResult
 *   cache miss → call monitor API → write to cache → return result
 *
 * The function is deterministic for a given session state: the same sessionId
 * always resolves to the same taskId once the task exists. The I/O effects
 * (FS read/write, HTTP) are necessary and explicit in the name.
 */
import { getCachedSessionResult, cacheSessionResult } from "./session-cache.js";
import { ensureRuntimeSession } from "./transport.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";

export async function resolveSessionIds(
    sessionId: string,
    title?: string,
    opts?: { parentTaskId?: string; parentSessionId?: string; taskId?: string }
): Promise<RuntimeSessionEnsureResult> {
    const cached = getCachedSessionResult(sessionId);
    if (cached) return cached;
    const fresh = await ensureRuntimeSession(sessionId, title, opts);
    cacheSessionResult(sessionId, fresh);
    return fresh;
}
