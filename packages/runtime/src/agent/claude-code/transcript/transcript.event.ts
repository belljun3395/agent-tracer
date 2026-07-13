import type {TranscriptEntry} from "~runtime/agent/claude-code/transcript/transcript.reader.js";
import {KIND, type IngestTarget, type RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import {assistantCommentaryEvent} from "~runtime/domain/ingest/model/message.event.model.js";
import {isRecord} from "~runtime/support/json.js";
import {toTrimmedString} from "~runtime/support/text.js";
import {deterministicUlid} from "~runtime/support/ulid.js";

const SOURCE = "claude-transcript";

/** 같은 발화를 다시 읽어도 같은 멱등키를 내도록 세션과 엔트리와 위치로 ID를 짓는다. */
export function transcriptCommentaryId(
    sourceSessionId: string,
    entryUuid: string,
    contentIndex: number,
): string {
    return deterministicUlid([
        SOURCE,
        sourceSessionId,
        entryUuid,
        String(contentIndex),
        KIND.assistantCommentary,
    ]);
}

/** 도구 호출과 분리된 text 블록만 중간 발화 이벤트로 만든다. */
export function toCommentaryEvents(
    entries: readonly TranscriptEntry[],
    sourceSessionId: string,
    target: IngestTarget,
): RuntimeIngestEvent[] {
    const events = new Map<string, RuntimeIngestEvent>();

    for (const entry of entries) {
        const uuid = entry.uuid;
        if (entry.type !== "assistant" || typeof uuid !== "string" || !isRecord(entry.message)) continue;
        if (entry.message["role"] !== "assistant" || entry.message["stop_reason"] !== "tool_use") continue;

        const content = entry.message["content"];
        if (!Array.isArray(content)) continue;

        content.forEach((block, contentIndex) => {
            if (!isRecord(block) || block["type"] !== "text") return;
            const text = toTrimmedString(block["text"]);
            if (!text) return;

            const eventId = transcriptCommentaryId(sourceSessionId, uuid, contentIndex);
            events.set(eventId, assistantCommentaryEvent(target, {
                eventId,
                text,
                source: SOURCE,
                sourceId: sourceSessionId,
                contentIndex,
                assistantUuid: uuid,
                ...(typeof entry.parentUuid === "string" ? {parentUuid: entry.parentUuid} : {}),
                ...(typeof entry.requestId === "string" ? {requestId: entry.requestId} : {}),
            }));
        });
    }

    return [...events.values()];
}
