import type {TranscriptEntry} from "~runtime/agent/claude-code/transcript/transcript.reader.js";
import {extractUsageTokens} from "~runtime/agent/claude-code/transcript/transcript.usage.js";
import {KIND, type IngestTarget, type RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {assistantCommentaryEvent} from "~runtime/domain/ingest/model/message.event.model.js";
import {thoughtLoggedEvent} from "~runtime/domain/ingest/model/thought.event.model.js";
import {tokenUsageEvent} from "~runtime/domain/ingest/model/token.usage.event.model.js";
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

/** 같은 엔트리를 다시 읽어도 같은 멱등키를 내도록 thinking 블록 위치로 ID를 짓는다. */
export function transcriptThoughtId(
    sourceSessionId: string,
    entryUuid: string,
    contentIndex: number,
): string {
    return deterministicUlid([
        SOURCE,
        sourceSessionId,
        entryUuid,
        String(contentIndex),
        KIND.thoughtLogged,
    ]);
}

/** 하나의 API 응답이 여러 엔트리로 쪼개져도 message.id 하나에 한 건만 나오도록 ID를 짓는다. */
export function transcriptTokenUsageId(sourceSessionId: string, messageId: string): string {
    return deterministicUlid([SOURCE, sourceSessionId, messageId, KIND.tokenUsage]);
}

/** assistant 엔트리에서 tool_use 중간 발화·stop_reason 무관 thinking 기록·메시지당 한 건의 토큰 집계를 함께 뽑는다. */
export function toTranscriptEvents(
    entries: readonly TranscriptEntry[],
    sourceSessionId: string,
    target: IngestTarget,
): (RuntimeIngestEvent | RunEventInput)[] {
    const commentary = new Map<string, RuntimeIngestEvent>();
    const thoughts = new Map<string, RuntimeIngestEvent>();
    const usageEvents = new Map<string, RunEventInput>();

    for (const entry of entries) {
        const uuid = entry.uuid;
        if (entry.type !== "assistant" || typeof uuid !== "string" || !isRecord(entry.message)) continue;
        if (entry.message["role"] !== "assistant") continue;

        const parentUuid = typeof entry.parentUuid === "string" ? entry.parentUuid : undefined;
        const requestId = typeof entry.requestId === "string" ? entry.requestId : undefined;
        const content = entry.message["content"];

        if (Array.isArray(content)) {
            const isCommentaryTurn = entry.message["stop_reason"] === "tool_use";
            content.forEach((block, contentIndex) => {
                if (!isRecord(block)) return;

                if (isCommentaryTurn && block["type"] === "text") {
                    const text = toTrimmedString(block["text"]);
                    if (!text) return;
                    const eventId = transcriptCommentaryId(sourceSessionId, uuid, contentIndex);
                    commentary.set(eventId, assistantCommentaryEvent(target, {
                        eventId,
                        text,
                        source: SOURCE,
                        sourceId: sourceSessionId,
                        contentIndex,
                        assistantUuid: uuid,
                        ...(parentUuid !== undefined ? {parentUuid} : {}),
                        ...(requestId !== undefined ? {requestId} : {}),
                    }));
                    return;
                }

                if (block["type"] === "thinking") {
                    const thinking = toTrimmedString(block["thinking"]);
                    if (!thinking) return;
                    const eventId = transcriptThoughtId(sourceSessionId, uuid, contentIndex);
                    thoughts.set(eventId, thoughtLoggedEvent(target, {
                        eventId,
                        text: thinking,
                        source: SOURCE,
                        contentIndex,
                        assistantUuid: uuid,
                        ...(parentUuid !== undefined ? {parentUuid} : {}),
                        ...(requestId !== undefined ? {requestId} : {}),
                    }));
                }
            });
        }

        const tokens = extractUsageTokens(entry.message["usage"]);
        if (!tokens) continue;
        const messageId = typeof entry.message["id"] === "string" ? entry.message["id"] : uuid;
        if (usageEvents.has(messageId)) continue;

        usageEvents.set(messageId, tokenUsageEvent(target, {
            eventId: transcriptTokenUsageId(sourceSessionId, messageId),
            messageId,
            source: SOURCE,
            assistantUuid: uuid,
            ...tokens,
            ...(typeof entry.message["model"] === "string" ? {model: entry.message["model"]} : {}),
            ...(requestId !== undefined ? {requestId} : {}),
        }));
    }

    return [...commentary.values(), ...thoughts.values(), ...usageEvents.values()];
}
