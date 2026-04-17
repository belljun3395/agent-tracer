/**
 * Transcript Cursor Management
 *
 * Tracks the last-processed position in a Claude Code session transcript JSONL.
 * Used by transcript-tail to emit only new entries on each Stop/SubagentStop turn.
 *
 * File: <PROJECT_DIR>/.claude/.session-cache/<sessionId>-transcript-cursor.json
 */
import * as path from "node:path";
import { SESSION_CACHE_DIR } from "../util/paths.js";
import { deleteJsonFile, readJsonFile, writeJsonFile } from "./json-file-store.js";

export interface TranscriptCursor {
    lastEmittedUuid: string | null;
    byteOffset: number;
    fileSize: number;
}

function isTranscriptCursor(value: unknown): value is TranscriptCursor {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const parsed = value as Partial<TranscriptCursor>;
    return (
        typeof parsed.byteOffset === "number" &&
        typeof parsed.fileSize === "number" &&
        (typeof parsed.lastEmittedUuid === "string" || parsed.lastEmittedUuid === null)
    );
}

function cursorPath(sessionId: string): string {
    return path.join(SESSION_CACHE_DIR, `${sessionId}-transcript-cursor.json`);
}

/**
 * Reads the cursor for a session transcript.
 * @returns TranscriptCursor if present, null otherwise
 */
export function loadCursor(sessionId: string): TranscriptCursor | null {
    const parsed = readJsonFile(cursorPath(sessionId), isTranscriptCursor);
    if (!parsed) return null;
    return {
        lastEmittedUuid: typeof parsed.lastEmittedUuid === "string" ? parsed.lastEmittedUuid : null,
        byteOffset: parsed.byteOffset,
        fileSize: parsed.fileSize
    };
}

export function saveCursor(sessionId: string, cursor: TranscriptCursor): void {
    writeJsonFile(cursorPath(sessionId), cursor);
}

export function deleteCursor(sessionId: string): void {
    deleteJsonFile(cursorPath(sessionId));
}
