/**
 * Session resolution.
 *
 * Thin wrapper around ensureRuntimeSession. The server's
 * EnsureRuntimeSessionUseCase is idempotent for a given runtimeSessionId, so
 * every hook process can safely re-ensure on each invocation. Previous
 * versions cached the (taskId, sessionId) pair on disk to avoid N+1 ensure
 * calls; that FS state was removed in Phase 6 because the server is the
 * single source of truth and localhost round trips are cheap compared to
 * hook subprocess startup.
 */
import { ensureRuntimeSession } from "./transport.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";

export async function resolveSessionIds(
    sessionId: string,
    title?: string,
    opts?: { parentTaskId?: string; parentSessionId?: string; taskId?: string }
): Promise<RuntimeSessionEnsureResult> {
    return ensureRuntimeSession(sessionId, title, opts);
}
