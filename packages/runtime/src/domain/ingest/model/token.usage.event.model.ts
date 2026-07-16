import {KIND, LANE, provenEvidence, type IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";

/** 트랜스크립트 message.usage 하나를 원장에 남기는 데 필요한 입력이다. */
export interface TokenUsageInput {
    readonly eventId: string;
    readonly messageId: string;
    readonly source: string;
    readonly assistantUuid: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly model?: string;
    readonly requestId?: string;
}

/**
 * 서버 telemetryPayloadSchema는 strict라 payload 최상위 키는 여기 나열된 것만 허용된다:
 * title, body, lane, metadata, inputTokens, outputTokens, cacheReadTokens, cacheCreateTokens,
 * costUsd, durationMs, model, promptId.
 */
export function tokenUsageEvent(target: IngestTarget, input: TokenUsageInput): RunEventInput {
    return {
        id: input.eventId,
        kind: KIND.tokenUsage,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...(target.turnId ? {turnId: target.turnId} : {}),
        payload: {
            lane: LANE.telemetry,
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
            cacheReadTokens: input.cacheReadTokens,
            cacheCreateTokens: input.cacheCreateTokens,
            ...(input.model !== undefined ? {model: input.model} : {}),
            ...(input.requestId !== undefined ? {promptId: input.requestId} : {}),
            metadata: {
                ...provenEvidence("Claude Code transcript의 message.usage를 직접 수집했다."),
                messageId: input.messageId,
                source: input.source,
                assistantUuid: input.assistantUuid,
            },
        },
    };
}
