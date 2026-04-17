/**
 * Session Metadata Management
 *
 * Stores lightweight session metadata that spans the entire session lifecycle.
 * Used to preserve startedAt timestamp from session_start to session_end.
 *
 * File: <PROJECT_DIR>/.claude/.session-cache/<sessionId>-metadata.json
 */
import * as path from "node:path";
import { SESSION_CACHE_DIR } from "../util/paths.js";
import { deleteJsonFile, readJsonFile, writeJsonFile } from "./json-file-store.js";

export interface SessionMetadata {
    sessionId: string;
    startedAt: number;
    source?: string; // startup | resume | clear | compact
    projectDir?: string;
}

function isSessionMetadata(value: unknown): value is SessionMetadata {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const candidate = value as Partial<SessionMetadata>;
    return typeof candidate.sessionId === "string" && typeof candidate.startedAt === "number";
}

function metadataPath(sessionId: string): string {
    return path.join(SESSION_CACHE_DIR, `${sessionId}-metadata.json`);
}

/**
 * Reads session metadata file.
 * @param sessionId - The session identifier
 * @returns SessionMetadata if exists, null otherwise
 */
export function getSessionMetadata(sessionId: string): SessionMetadata | null {
    return readJsonFile(metadataPath(sessionId), isSessionMetadata);
}

/**
 * Saves session metadata file.
 * @param metadata - SessionMetadata to persist
 */
export function saveSessionMetadata(metadata: SessionMetadata): void {
    writeJsonFile(metadataPath(metadata.sessionId), metadata);
}

/**
 * Deletes session metadata file.
 * @param sessionId - The session identifier
 */
export function deleteSessionMetadata(sessionId: string): void {
    deleteJsonFile(metadataPath(sessionId));
}
