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
import * as fs from "node:fs";
import * as path from "node:path";
import { SESSION_CACHE_DIR } from "../util/paths.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";

export function getCachedSessionResult(sessionId: string): RuntimeSessionEnsureResult | null {
    const cachePath = path.join(SESSION_CACHE_DIR, `${sessionId}.json`);
    try {
        return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as RuntimeSessionEnsureResult;
    } catch {
        return null;
    }
}

export function cacheSessionResult(sessionId: string, result: RuntimeSessionEnsureResult): void {
    try {
        fs.mkdirSync(SESSION_CACHE_DIR, { recursive: true });
        fs.writeFileSync(path.join(SESSION_CACHE_DIR, `${sessionId}.json`), JSON.stringify(result));
    } catch {
        void 0;
    }
}

export function deleteCachedSessionResult(sessionId: string): void {
    const cachePath = path.join(SESSION_CACHE_DIR, `${sessionId}.json`);
    try {
        fs.unlinkSync(cachePath);
    } catch {
        void 0;
    }
}
