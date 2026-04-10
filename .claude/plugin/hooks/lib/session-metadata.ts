/**
 * Session Metadata Management
 *
 * Stores lightweight session metadata that spans the entire session lifecycle.
 * Used to preserve startedAt timestamp from session_start to session_end.
 *
 * File: <PROJECT_DIR>/.claude/.session-cache/<sessionId>-metadata.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { SESSION_CACHE_DIR } from "../util/paths.js";

export interface SessionMetadata {
    sessionId: string;
    startedAt: number;
    source?: string; // startup | resume | clear | compact
    projectDir?: string;
}

/**
 * Reads session metadata file.
 * @param sessionId - The session identifier
 * @returns SessionMetadata if exists, null otherwise
 */
export function getSessionMetadata(sessionId: string): SessionMetadata | null {
    const metaPath = path.join(SESSION_CACHE_DIR, `${sessionId}-metadata.json`);
    try {
        const content = fs.readFileSync(metaPath, "utf-8");
        return JSON.parse(content) as SessionMetadata;
    } catch {
        return null;
    }
}

/**
 * Saves session metadata file.
 * @param metadata - SessionMetadata to persist
 */
export function saveSessionMetadata(metadata: SessionMetadata): void {
    try {
        fs.mkdirSync(SESSION_CACHE_DIR, { recursive: true });
        const metaPath = path.join(SESSION_CACHE_DIR, `${metadata.sessionId}-metadata.json`);
        fs.writeFileSync(metaPath, JSON.stringify(metadata));
    } catch {
        void 0;
    }
}

/**
 * Deletes session metadata file.
 * @param sessionId - The session identifier
 */
export function deleteSessionMetadata(sessionId: string): void {
    const metaPath = path.join(SESSION_CACHE_DIR, `${sessionId}-metadata.json`);
    try {
        fs.unlinkSync(metaPath);
    } catch {
        void 0;
    }
}
