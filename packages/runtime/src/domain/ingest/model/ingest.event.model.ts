import {toSemconvAttributes} from "@monitor/kernel/observability/semconv.const.js";
import type {RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";

/** 원장 인제스트 봉투이며 여기 선언되지 않은 필드는 payload로 들어가고 id는 클라이언트 멱등키다. */
export interface IngestEvent {
    readonly id: string;
    readonly kind: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly parentId?: string;
    readonly turnId?: string;
    readonly occurredAt: string;
    readonly payload: Record<string, unknown>;
}

export const INGEST_EVENTS_ENDPOINT = "/ingest/v1/events";

/** 런타임 이벤트를 봉투로 감싸면서 camelCase 메타데이터를 semconv 속성으로 정규화한다. */
export function toIngestEvent(
    event: RuntimeIngestEvent,
    occurredAt: string,
    nextId: () => string,
): IngestEvent {
    const {id, kind, taskId, sessionId, parentId, turnId, metadata, ...rest} = event;
    return {
        id: id ?? nextId(),
        kind,
        taskId,
        ...(sessionId ? {sessionId} : {}),
        ...(parentId ? {parentId} : {}),
        ...(turnId ? {turnId} : {}),
        occurredAt,
        payload: {...rest, metadata: toSemconvAttributes(metadata as Record<string, unknown>)},
    };
}

/** payload를 고정해 보내는 원장 이벤트 입력이다. */
export interface RunEventInput {
    readonly kind: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly turnId?: string;
    readonly payload: Record<string, unknown>;
}

export function toRunIngestEvent(
    input: RunEventInput,
    occurredAt: string,
    nextId: () => string,
): IngestEvent {
    return {
        id: nextId(),
        kind: input.kind,
        taskId: input.taskId,
        ...(input.sessionId ? {sessionId: input.sessionId} : {}),
        ...(input.turnId ? {turnId: input.turnId} : {}),
        occurredAt,
        payload: input.payload,
    };
}
