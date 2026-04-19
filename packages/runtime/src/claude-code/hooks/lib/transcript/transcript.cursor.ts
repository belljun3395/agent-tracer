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
import {TRANSCRIPT_CURSOR_DIR} from "~claude-code/hooks/util/paths.const.js";
import type {TranscriptCursor} from "~claude-code/hooks/lib/transcript/transcript.cursor.type.js";
import {deleteJsonFile, readJsonFile, writeJsonFile} from "~claude-code/hooks/util/json-file.store.js";

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

/**
 * Reads the cursor file for the given session from disk, validates its shape,
 * and returns it. Returns `null` if the file does not exist or fails validation.
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

/**
 * Serialises the cursor object and writes it to the session's cursor file,
 * creating directories as needed.
 */
export function saveCursor(sessionId: string, cursor: TranscriptCursor): void {
    writeJsonFile(cursorPath(sessionId), cursor);
}

/**
 * Removes the session's cursor file. Silently succeeds if the file does not exist.
 */
export function deleteCursor(sessionId: string): void {
    deleteJsonFile(cursorPath(sessionId));
}
