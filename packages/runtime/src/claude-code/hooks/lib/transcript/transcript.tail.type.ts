import type {TranscriptCursor} from "~claude-code/hooks/lib/transcript/transcript.cursor.type.js";
import type {TranscriptIngestEvent, TranscriptEntry} from "~claude-code/hooks/lib/transcript/transcript.emit.type.js";

export interface TailResult {
    entries: TranscriptEntry[];
    nextCursor: TranscriptCursor;
}

export interface TailAndBuildResult {
    events: TranscriptIngestEvent[];
    nextCursor: TranscriptCursor;
    totalNewEntries: number;
}
