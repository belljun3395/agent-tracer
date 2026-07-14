import {
    COORDINATION_EVENT_KINDS,
    KIND,
    LANE,
    TELEMETRY_EVENT_KINDS,
    type EventKind,
    type EventLane,
} from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { EventEntity } from "@monitor/tracer-domain";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

const TELEMETRY_SET = new Set<string>(TELEMETRY_EVENT_KINDS);
const COORDINATION_SET = new Set<string>(COORDINATION_EVENT_KINDS);

/** 정규화된 이벤트에서 추출한 타임라인 표시 필드이며 project·index 슬라이스가 함께 읽는다. */
export interface EventFields {
    readonly lane: EventLane;
    readonly title: string;
    readonly body: string | null;
    readonly toolName: string | null;
    readonly filePaths: string[];
    readonly metadata: Record<string, unknown>;
}

/** 초기 런타임이 원장에 user로 적어둔 종류라 페이로드 레인을 무시하고 여기서 바로잡는다. */
const KIND_OWNED_LANE: Partial<Record<EventKind, EventLane>> = {
    [KIND.assistantCommentary]: LANE.assistant,
    [KIND.assistantResponse]: LANE.assistant,
    [KIND.invokeAgent]: LANE.coordination,
};

function deriveLane(kind: EventKind): EventLane {
    if (TELEMETRY_SET.has(kind)) return LANE.telemetry;
    if (COORDINATION_SET.has(kind)) return LANE.coordination;
    if (kind === KIND.assistantCommentary || kind === KIND.assistantResponse) return LANE.assistant;
    if (kind === KIND.userMessage) return LANE.user;
    if (kind === KIND.questionLogged) return LANE.questions;
    if (kind === KIND.todoLogged) return LANE.todos;
    if (kind === KIND.ruleLogged) return LANE.rule;
    if (kind === KIND.planLogged) return LANE.planning;
    return LANE.background;
}

export function extractEventFields(record: LedgerRecord): EventFields {
    const payload = parseStoredEventPayload(record.payload);
    return {
        lane: KIND_OWNED_LANE[record.kind] ?? payload.lane ?? deriveLane(record.kind),
        title: payload.title ?? "",
        body: payload.body ?? null,
        toolName: payload.toolName ?? null,
        filePaths: payload.filePaths,
        metadata: payload.metadata,
    };
}

export function buildEventEntity(record: LedgerRecord): EventEntity {
    const fields = extractEventFields(record);
    const event = new EventEntity();
    event.id = record.id;
    event.seq = record.seq;
    event.userId = record.userId;
    event.taskId = record.taskId;
    event.sessionId = record.sessionId;
    event.turnId = null;
    event.kind = record.kind;
    event.lane = fields.lane;
    event.title = fields.title;
    event.body = fields.body;
    event.toolName = fields.toolName;
    event.filePaths = fields.filePaths;
    event.metadata = fields.metadata;
    event.traceId = record.traceId;
    event.spanId = record.spanId;
    event.parentSpanId = record.parentSpanId;
    event.occurredAt = record.occurredAt;
    return event;
}
