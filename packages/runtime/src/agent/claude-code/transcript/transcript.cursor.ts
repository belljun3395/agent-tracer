import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {resolveAgentTracerPaths} from "~runtime/config/home.paths.js";
import {isRecord} from "~runtime/support/json.js";
import {readJsonFile, writeJsonFile} from "~runtime/support/json.file.store.js";

const HEAD_FINGERPRINT_BYTES = 4096;

/** 어디까지 읽었는지와 그 파일이 같은 파일인지를 함께 담는 트랜스크립트 커서다. */
export interface TranscriptCursor {
    readonly transcriptPath: string;
    readonly byteOffset: number;
    readonly fileSize: number;
    readonly headLength: number;
    readonly headHash: string;
}

export function resolveTranscriptCursorDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(resolveAgentTracerPaths(env).cacheDir, "claude-transcript-cursors");
}

export function loadTranscriptCursor(sourceSessionId: string, cursorDir: string): TranscriptCursor | null {
    return readJsonFile(cursorPath(sourceSessionId, cursorDir), isTranscriptCursor);
}

/** 앞서 저장된 커서를 느린 훅이 되돌리지 않도록 같은 파일이면 뒤로 물리지 않는다. */
export function saveTranscriptCursor(
    sourceSessionId: string,
    cursor: TranscriptCursor,
    cursorDir: string,
): void {
    const current = loadTranscriptCursor(sourceSessionId, cursorDir);
    if (current?.transcriptPath === cursor.transcriptPath
        && current.fileSize >= cursor.fileSize
        && current.byteOffset > cursor.byteOffset) {
        try {
            if (hashFileHead(cursor.transcriptPath, cursor.headLength) === cursor.headHash) return;
        } catch {
            // 다음 훅이 fingerprint 불일치를 보고 처음부터 다시 읽는다.
        }
    }
    writeJsonFile(cursorPath(sourceSessionId, cursorDir), cursor);
}

/** 파일이 교체됐으면 처음부터 다시 읽도록 0을 낸다. */
export function resolveTranscriptStartOffset(
    cursor: TranscriptCursor | null,
    transcriptPath: string,
    fileSize: number,
): number {
    if (!cursor || cursor.transcriptPath !== transcriptPath) return 0;
    if (fileSize < cursor.fileSize || cursor.byteOffset > fileSize) return 0;
    if (cursor.headLength > fileSize) return 0;
    if (hashFileHead(transcriptPath, cursor.headLength) !== cursor.headHash) return 0;
    return cursor.byteOffset;
}

export function createTranscriptCursor(
    transcriptPath: string,
    byteOffset: number,
    fileSize: number,
): TranscriptCursor {
    const headLength = Math.min(HEAD_FINGERPRINT_BYTES, fileSize);
    return {
        transcriptPath,
        byteOffset,
        fileSize,
        headLength,
        headHash: hashFileHead(transcriptPath, headLength),
    };
}

function isTranscriptCursor(value: unknown): value is TranscriptCursor {
    if (!isRecord(value)) return false;
    return typeof value["transcriptPath"] === "string"
        && isOffset(value["byteOffset"])
        && isOffset(value["fileSize"])
        && isOffset(value["headLength"])
        && typeof value["headHash"] === "string";
}

function isOffset(value: unknown): boolean {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function cursorPath(sourceSessionId: string, cursorDir: string): string {
    const key = crypto.createHash("sha256").update(sourceSessionId).digest("hex").slice(0, 32);
    return path.join(cursorDir, `${key}.json`);
}

function hashFileHead(transcriptPath: string, length: number): string {
    if (length === 0) return crypto.createHash("sha256").digest("hex");
    const fd = fs.openSync(transcriptPath, "r");
    try {
        const buffer = Buffer.alloc(length);
        const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
        return crypto.createHash("sha256").update(buffer.subarray(0, bytesRead)).digest("hex");
    } finally {
        fs.closeSync(fd);
    }
}
