/**
 * Cursor-based transcript tail.
 *
 * Reads a Claude Code session transcript JSONL and returns only the entries
 * that appeared since the last tail. Safe against file truncation (e.g. after
 * `/compact`) because we stat the file size each invocation; if the file is
 * smaller than the recorded fileSize we reset the cursor.
 *
 * Two-tier read strategy:
 *   1. Fast path — seek to the stored byteOffset, peek the first new line.
 *      If that line's uuid matches lastEmittedUuid we slice entries after it.
 *   2. Fallback — read the whole file and locate lastEmittedUuid by UUID
 *      equality. Guards us from byte-offset drift when Claude Code rewrites
 *      earlier entries (rare, observed around forks).
 *
 * Always persists the new cursor after emitting, even when 0 entries matched,
 * so the fast path stays warm on the next turn.
 */
import * as fs from "node:fs";
import {buildEventsFromEntries, findNewSince, parseJsonlLines} from "~claude-code/hooks/lib/transcript/transcript.emit.js";
import {loadCursor, saveCursor} from "~claude-code/hooks/lib/transcript/transcript.cursor.js";
import type {TranscriptEventIds} from "~claude-code/hooks/lib/transcript/transcript.emit.type.js";
import type {TranscriptCursor} from "~claude-code/hooks/lib/transcript/transcript.cursor.type.js";
import type {TailAndBuildResult, TailResult} from "~claude-code/hooks/lib/transcript/transcript.tail.type.js";


function readNewTranscriptEntries(
    sessionId: string,
    transcriptPath: string
): TailResult {
    const empty: TailResult = {
        entries: [],
        nextCursor: {lastEmittedUuid: null, byteOffset: 0, fileSize: 0}
    };

    let stat: fs.Stats;
    try {
        stat = fs.statSync(transcriptPath);
    } catch {
        return empty;
    }
    const fileSize = stat.size;
    if (fileSize === 0) return empty;

    const cursor = loadCursor(sessionId);
    const lastUuid = cursor?.lastEmittedUuid ?? null;

    // File got smaller (compact/truncate) — reset cursor.
    const cursorStale = !!cursor && fileSize < cursor.fileSize;

    let content: string;
    try {
        content = fs.readFileSync(transcriptPath, "utf8");
    } catch {
        return empty;
    }

    const allEntries = parseJsonlLines(content);
    if (allEntries.length === 0) {
        return {
            entries: [],
            nextCursor: {lastEmittedUuid: null, byteOffset: fileSize, fileSize}
        };
    }

    const baseUuid = cursorStale ? null : lastUuid;
    const newEntries = findNewSince(allEntries, baseUuid);

    const lastEntry = allEntries[allEntries.length - 1];
    const nextCursor: TranscriptCursor = {
        lastEmittedUuid: lastEntry?.uuid ?? baseUuid ?? null,
        byteOffset: fileSize,
        fileSize
    };

    return {entries: newEntries, nextCursor};
}

/**
 * Loads the current cursor, reads new transcript entries since the last emitted UUID,
 * and converts them to ingest events. Returns events, the next cursor state, and the
 * count of new entries. Does NOT persist the cursor — call `commitCursor` after
 * successfully posting.
 */
export function tailTranscriptAsEvents(
    sessionId: string,
    transcriptPath: string,
    ids: TranscriptEventIds
): TailAndBuildResult {
    const {entries, nextCursor} = readNewTranscriptEntries(sessionId, transcriptPath);
    const events = buildEventsFromEntries(entries, ids);
    return {events, nextCursor, totalNewEntries: entries.length};
}

/**
 * Persists the cursor returned by `tailTranscriptAsEvents` to disk. Must be
 * called only after events have been successfully posted to the monitor.
 */
export function commitCursor(sessionId: string, cursor: TranscriptCursor): void {
    saveCursor(sessionId, cursor);
}
