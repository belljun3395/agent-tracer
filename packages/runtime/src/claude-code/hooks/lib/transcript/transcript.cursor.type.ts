export interface TranscriptCursor {
    lastEmittedUuid: string | null;
    byteOffset: number;
    fileSize: number;
}