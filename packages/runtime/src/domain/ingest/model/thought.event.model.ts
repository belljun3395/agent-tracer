import {
    KIND,
    LANE,
    provenEvidence,
    turnOf,
    type IngestTarget,
    type RuntimeIngestEvent,
} from "~runtime/domain/ingest/model/event.model.js";
import type {ThoughtLoggedMetadata} from "~runtime/domain/ingest/model/session.metadata.model.js";
import {ellipsize, truncateOutput} from "~runtime/support/text.js";

const TITLE_MAX = 120;
const THOUGHT_HEAD = 4096;
const THOUGHT_TAIL = 2048;

/** 트랜스크립트에서 뽑은 thinking 블록 하나를 원장에 남기는 데 필요한 입력이다. */
export interface ThoughtLoggedInput {
    readonly eventId: string;
    readonly text: string;
    readonly source: string;
    readonly contentIndex: number;
    readonly assistantUuid: string;
    readonly parentUuid?: string;
    readonly requestId?: string;
}

export function thoughtLoggedEvent(
    target: IngestTarget,
    input: ThoughtLoggedInput,
): RuntimeIngestEvent {
    const captured = truncateOutput(input.text, THOUGHT_HEAD, THOUGHT_TAIL);
    const metadata: ThoughtLoggedMetadata = {
        ...provenEvidence("Claude Code transcript의 thinking 블록을 직접 수집했다."),
        messageId: input.eventId,
        source: input.source,
        contentIndex: input.contentIndex,
        assistantUuid: input.assistantUuid,
        ...(input.parentUuid !== undefined ? {parentUuid: input.parentUuid} : {}),
        ...(input.requestId !== undefined ? {requestId: input.requestId} : {}),
        thinkingBytes: captured.bytes,
        ...(captured.truncated ? {thinkingTruncated: true} : {}),
    };
    return {
        id: input.eventId,
        kind: KIND.thoughtLogged,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.assistant,
        title: ellipsize(input.text, TITLE_MAX),
        body: captured.body,
        metadata,
    };
}
