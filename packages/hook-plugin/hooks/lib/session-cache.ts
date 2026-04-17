/**
 * File-system backed session result cache.
 *
 * Hook processes are short-lived (one process per event). This cache persists
 * the taskId/sessionId returned by ensureRuntimeSession across invocations so
 * subsequent hooks for the same session avoid redundant API calls.
 *
 * Cache location: <PROJECT_DIR>/.claude/.session-cache/<session_id>.json
 * Entries are deleted by session_end.ts when the session terminates.
 */
import * as path from "node:path";
import { SESSION_CACHE_DIR } from "../util/paths.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";
import { deleteJsonFile, readJsonFile, writeJsonFile } from "./json-file-store.js";

function isRuntimeSessionEnsureResult(value: unknown): value is RuntimeSessionEnsureResult {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const candidate = value as Partial<RuntimeSessionEnsureResult>;
    return typeof candidate.taskId === "string" && typeof candidate.sessionId === "string";
}

function cachePath(sessionId: string): string {
    return path.join(SESSION_CACHE_DIR, `${sessionId}.json`);
}

export function getCachedSessionResult(sessionId: string): RuntimeSessionEnsureResult | null {
    return readJsonFile(cachePath(sessionId), isRuntimeSessionEnsureResult);
}

export function cacheSessionResult(sessionId: string, result: RuntimeSessionEnsureResult): void {
    writeJsonFile(cachePath(sessionId), result);
}

export function deleteCachedSessionResult(sessionId: string): void {
    deleteJsonFile(cachePath(sessionId));
}
