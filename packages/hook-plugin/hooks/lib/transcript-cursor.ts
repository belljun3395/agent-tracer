/**
 * Transcript Cursor Management
 *
 * Tracks the last-processed position in a Claude Code session transcript JSONL.
 * Used by transcript-tail to emit only new entries on each Stop/SubagentStop turn.
 *
 * Primary location: `<PROJECT_DIR>/.claude/.transcript-cursors/<sessionId>.json`
 *
 * Migration fallback: plugin versions < 0.2.0 stored the cursor alongside the
 * removed session cache at `<PROJECT_DIR>/.claude/.session-cache/<sessionId>-transcript-cursor.json`.
 * On first read we fall back to that path so users mid-upgrade keep their
 * existing cursor; the first successful write to the new location unlinks the
 * legacy file so the `.session-cache/` directory drains naturally.
 */
import * as path from "node:path";
import { TRANSCRIPT_CURSOR_DIR, LEGACY_SESSION_CACHE_DIR } from "../util/paths.js";
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
    return path.join(TRANSCRIPT_CURSOR_DIR, `${sessionId}.json`);
}

function legacyCursorPath(sessionId: string): string {
    return path.join(LEGACY_SESSION_CACHE_DIR, `${sessionId}-transcript-cursor.json`);
}

/**
 * Reads the cursor for a session transcript.
 * Falls back to the legacy `.session-cache/` location if no cursor exists at
 * the new path (plugin v<0.2.0 upgrade path).
 * @returns TranscriptCursor if present, null otherwise
 */
export function loadCursor(sessionId: string): TranscriptCursor | null {
    const parsed =
        readJsonFile(cursorPath(sessionId), isTranscriptCursor) ??
        readJsonFile(legacyCursorPath(sessionId), isTranscriptCursor);
    if (!parsed) return null;
    return {
        lastEmittedUuid: typeof parsed.lastEmittedUuid === "string" ? parsed.lastEmittedUuid : null,
        byteOffset: parsed.byteOffset,
        fileSize: parsed.fileSize
    };
}

export function saveCursor(sessionId: string, cursor: TranscriptCursor): void {
    writeJsonFile(cursorPath(sessionId), cursor);
    // Drain the legacy path once the new cursor is durable, so stale data
    // can't be picked up by loadCursor on a future run.
    deleteJsonFile(legacyCursorPath(sessionId));
}

export function deleteCursor(sessionId: string): void {
    deleteJsonFile(cursorPath(sessionId));
    deleteJsonFile(legacyCursorPath(sessionId));
}
