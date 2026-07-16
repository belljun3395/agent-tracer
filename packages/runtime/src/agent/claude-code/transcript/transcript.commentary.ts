import * as fs from "node:fs";
import {
    createTranscriptCursor,
    loadTranscriptCursor,
    resolveTranscriptCursorDir,
    resolveTranscriptStartOffset,
    saveTranscriptCursor,
    type TranscriptCursor,
} from "~runtime/agent/claude-code/transcript/transcript.cursor.js";
import {toTranscriptEvents} from "~runtime/agent/claude-code/transcript/transcript.event.js";
import {
    entriesAfterLatestUserPrompt,
    readTranscriptEntries,
} from "~runtime/agent/claude-code/transcript/transcript.reader.js";
import type {IngestTarget, RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {subagentSessionId} from "~runtime/domain/session/model/session.event.model.js";

type PostEvents = (events: readonly (RuntimeIngestEvent | RunEventInput)[]) => Promise<void>;

/** 어느 트랜스크립트를 누구의 것으로 읽을지 정하는 훅 문맥이다. */
export interface TranscriptContext {
    readonly sessionId: string;
    readonly agentId?: string | undefined;
    readonly transcriptPath?: string | undefined;
    readonly agentTranscriptPath?: string | undefined;
}

export interface TranscriptTail {
    readonly events: (RuntimeIngestEvent | RunEventInput)[];
    readonly nextCursor: TranscriptCursor;
}

/** 커서 이후의 중간 발화를 모으고 첫 수집이면 마지막 사용자 프롬프트 이후만 본다. */
export function tailTranscriptCommentary(
    sourceSessionId: string,
    transcriptPath: string,
    target: IngestTarget,
    cursorDir: string = resolveTranscriptCursorDir(),
): TranscriptTail | null {
    let fileSize: number;
    try {
        const stat = fs.statSync(transcriptPath);
        if (!stat.isFile()) return null;
        fileSize = stat.size;
    } catch {
        return null;
    }

    try {
        const cursor = loadTranscriptCursor(sourceSessionId, cursorDir);
        const startOffset = resolveTranscriptStartOffset(cursor, transcriptPath, fileSize);
        const read = readTranscriptEntries(transcriptPath, startOffset, fileSize);
        const nextCursor = createTranscriptCursor(transcriptPath, read.byteOffset, fileSize);
        const entries = cursor ? read.entries : entriesAfterLatestUserPrompt(read.entries);
        return {events: toTranscriptEvents(entries, sourceSessionId, target), nextCursor};
    } catch {
        return null;
    }
}

/** 전송에 성공했을 때만 커서를 확정해 실패한 발화를 다음 훅이 다시 보낸다. */
export async function captureTranscriptCommentary(
    context: TranscriptContext,
    target: IngestTarget,
    postEvents: PostEvents,
    cursorDir: string = resolveTranscriptCursorDir(),
): Promise<void> {
    const transcriptPath = context.agentTranscriptPath ?? context.transcriptPath;
    if (transcriptPath === undefined) return;
    const sourceSessionId = context.agentId !== undefined
        ? subagentSessionId(context.agentId)
        : context.sessionId;

    try {
        const tail = tailTranscriptCommentary(sourceSessionId, transcriptPath, target, cursorDir);
        if (tail === null) return;
        if (tail.events.length > 0) await postEvents(tail.events);
        saveTranscriptCursor(sourceSessionId, tail.nextCursor, cursorDir);
    } catch {
        // 트랜스크립트 수집 실패는 Claude Code의 훅 동작을 막지 않는다.
    }
}
