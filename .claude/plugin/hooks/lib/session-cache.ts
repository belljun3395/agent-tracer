import * as fs from "node:fs";
import * as path from "node:path";
import { PROJECT_DIR } from "./paths.js";
import type { RuntimeSessionEnsureResult } from "./transport.js";

const SESSION_CACHE_DIR = path.join(PROJECT_DIR, ".claude", ".session-cache");

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
