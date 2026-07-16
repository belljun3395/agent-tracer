import * as fs from "node:fs";
import {
    TRANSCRIPT_ENTRY_TYPE,
    TRANSCRIPT_MESSAGE_ROLE,
} from "~runtime/agent/claude-code/transcript/transcript.wire.js";
import {isRecord} from "~runtime/support/json.js";

const NEWLINE = 0x0a;

/** 훅 한 번이 트랜스크립트에서 읽는 최대 바이트 수다. */
export const TRANSCRIPT_READ_MAX_BYTES = 1024 * 1024;

/** 트랜스크립트 JSONL 한 줄이다. */
export interface TranscriptEntry {
    readonly type?: unknown;
    readonly uuid?: unknown;
    readonly parentUuid?: unknown;
    readonly requestId?: unknown;
    readonly isMeta?: unknown;
    readonly message?: unknown;
}

export interface TranscriptRead {
    readonly entries: TranscriptEntry[];
    readonly byteOffset: number;
}

/** 마지막 사용자 프롬프트 이후의 엔트리만 남긴다. */
export function entriesAfterLatestUserPrompt(
    entries: readonly TranscriptEntry[],
): readonly TranscriptEntry[] {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (entry?.type !== TRANSCRIPT_ENTRY_TYPE.user || entry.isMeta === true || !isRecord(entry.message)) continue;
        if (entry.message["role"] !== TRANSCRIPT_MESSAGE_ROLE.user || typeof entry.message["content"] !== "string") continue;
        return entries.slice(index + 1);
    }
    return entries;
}

/** 커서 이후를 읽되 완성되지 않은 마지막 줄은 다음 훅이 이어 읽도록 남긴다. */
export function readTranscriptEntries(
    transcriptPath: string,
    startOffset: number,
    fileSize: number,
): TranscriptRead {
    if (startOffset >= fileSize) return {entries: [], byteOffset: startOffset};

    const readStart = Math.max(startOffset, fileSize - TRANSCRIPT_READ_MAX_BYTES);
    const fd = fs.openSync(transcriptPath, "r");
    try {
        const buffer = Buffer.alloc(fileSize - readStart);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, readStart);
        const content = buffer.subarray(0, bytesRead);

        let parseStart = 0;
        if (readStart > startOffset) {
            const firstNewline = content.indexOf(NEWLINE);
            if (firstNewline < 0) return {entries: [], byteOffset: fileSize};
            parseStart = firstNewline + 1;
        }

        const lastNewline = content.lastIndexOf(NEWLINE);
        const entries: TranscriptEntry[] = [];
        let consumed = parseStart;

        if (lastNewline >= parseStart) {
            for (const line of content.toString("utf8", parseStart, lastNewline).split("\n")) {
                const entry = parseJsonLine(line);
                if (entry) entries.push(entry);
            }
            consumed = lastNewline + 1;
        }

        const trailing = parseJsonLine(content.toString("utf8", consumed));
        if (trailing) {
            entries.push(trailing);
            consumed = content.length;
        }

        return {entries, byteOffset: readStart + consumed};
    } finally {
        fs.closeSync(fd);
    }
}

/** JSONL 한 줄을 던지지 않고 레코드로 파싱한다. */
export function parseJsonLine(line: string): Record<string, unknown> | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        const parsed: unknown = JSON.parse(trimmed);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}
