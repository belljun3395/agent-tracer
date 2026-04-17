/**
 * Transcript Cursor Management
 *
 * Tracks the last-processed position in a Claude Code session transcript JSONL.
 * Used by transcript-tail to emit only new entries on each Stop/SubagentStop turn.
 *
 * File: <PROJECT_DIR>/.claude/.session-cache/<sessionId>-transcript-cursor.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { SESSION_CACHE_DIR } from "../util/paths.js";

export interface TranscriptCursor {
    lastEmittedUuid: string | null;
    byteOffset: number;
    fileSize: number;
}

function cursorPath(sessionId: string): string {
    return path.join(SESSION_CACHE_DIR, `${sessionId}-transcript-cursor.json`);
}

/**
 * Reads the cursor for a session transcript.
 * @returns TranscriptCursor if present, null otherwise
 */
export function loadCursor(sessionId: string): TranscriptCursor | null {
    try {
        const content = fs.readFileSync(cursorPath(sessionId), "utf-8");
        const parsed = JSON.parse(content) as Partial<TranscriptCursor>;
        if (
            typeof parsed.byteOffset !== "number" ||
            typeof parsed.fileSize !== "number"
        ) {
            return null;
        }
        return {
            lastEmittedUuid:
                typeof parsed.lastEmittedUuid === "string" ? parsed.lastEmittedUuid : null,
            byteOffset: parsed.byteOffset,
            fileSize: parsed.fileSize
        };
    } catch {
        return null;
    }
}

export function saveCursor(sessionId: string, cursor: TranscriptCursor): void {
    try {
        fs.mkdirSync(SESSION_CACHE_DIR, { recursive: true });
        fs.writeFileSync(cursorPath(sessionId), JSON.stringify(cursor));
    } catch {
        void 0;
    }
}

export function deleteCursor(sessionId: string): void {
    try {
        fs.unlinkSync(cursorPath(sessionId));
    } catch {
        void 0;
    }
}
