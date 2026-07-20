import { z } from "zod";
import {
    KIND,
    TIMELINE_EVENT_KINDS,
    TELEMETRY_EVENT_KINDS,
    RECIPE_INJECTED_VIA,
    USER_MESSAGE_PROMPT_ORIGINS,
    type EventKind,
} from "./event.kind.const.js";
import { EVENT_LANES } from "./event.lane.const.js";
import {findJsonTextViolation} from "./json.text.js";
import {contractVersionFieldSchema} from "./contract.version.schema.js";
import {
    MONITORING_TASK_KINDS,
    TASK_ORIGINS,
    TASK_STATUSES,
    TASK_COMPLETION_REASONS,
} from "./task.const.js";

/** 인제스트 이벤트 봉투이며, payload 밖의 필드는 이것이 전부다. */
export const ingestEventBaseSchema = z.object({
    /** 클라이언트가 생성하는 ULID 멱등키다. */
    id: z.string().min(1),
    kind: z.string().min(1),
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    /** OTLP parent_span_id의 유일한 근거인 인과 부모 이벤트 식별자다. */
    parentId: z.string().min(1).optional(),
    /** 트레이스 경계이자 턴 span의 앵커이며, 서버가 조립하는 turn_id와는 별개 식별자다. */
    turnId: z.string().min(1).optional(),
    occurredAt: z.string().datetime(),
    payload: z.record(z.unknown()).default({}),
});

export const ingestBatchSchema = z.object({
    /** 배치를 만든 데몬의 계약 버전이며, 지원 여부 판정은 서버 가드가 별도로 한다. */
    contractVersion: contractVersionFieldSchema,
    events: z.array(ingestEventBaseSchema).min(1).max(100),
});

/** 모든 훅 이벤트가 payload에 싣는 공통 표시 필드다. */
const commonPayloadFields = {
    title: z.string().optional(),
    body: z.string().optional(),
    lane: z.enum(EVENT_LANES).optional(),
    metadata: z.record(z.unknown()).optional(),
};

const timelinePayloadSchema = z.object({
    ...commonPayloadFields,
    title: z.string().optional(),
    body: z.string().optional(),
    lane: z.enum(EVENT_LANES).optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    toolName: z.string().optional(),
    /** 실패한 셸 도구 호출이 payload 최상위에 싣는 실행 명령문이다. */
    command: z.string().optional(),
    /** userMessage kind에서만 싣는 발화 출처이며 시스템이 주입한 알림 텍스트를 사용자 발화와 가른다. */
    promptOrigin: z.enum(USER_MESSAGE_PROMPT_ORIGINS).optional(),
    parentEventId: z.string().min(1).optional(),
    taskEffects: z.object({ taskStatus: z.enum(TASK_STATUSES).optional() }).optional(),
}).strict();

const telemetryPayloadSchema = z.object({
    ...commonPayloadFields,
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative().default(0),
    cacheCreateTokens: z.number().int().nonnegative().default(0),
    costUsd: z.number().nonnegative().optional(),
    durationMs: z.number().nonnegative().optional(),
    model: z.string().optional(),
    promptId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
}).strict();

const sessionStartedPayloadSchema = z.object({
    ...commonPayloadFields,
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    taskKind: z.enum(MONITORING_TASK_KINDS).optional(),
    origin: z.enum(TASK_ORIGINS).optional(),
    resume: z.boolean().optional(),
}).strict();

const sessionEndedPayloadSchema = z.object({
    ...commonPayloadFields,
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    summary: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(TASK_COMPLETION_REASONS).optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional(),
}).strict();

const taskStartPayloadSchema = z.object({
    ...commonPayloadFields,
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    runtimeSource: z.string().min(1).optional(),
    summary: z.string().optional(),
    taskKind: z.enum(MONITORING_TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
}).strict();

const taskLinkedPayloadSchema = z.object({
    ...commonPayloadFields,
    title: z.string().trim().min(1).optional(),
    taskKind: z.enum(MONITORING_TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional(),
}).strict();

const taskCompletePayloadSchema = z.object({
    ...commonPayloadFields,
    summary: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
}).strict();

const taskErrorPayloadSchema = taskCompletePayloadSchema.extend({
    errorMessage: z.string().min(1),
});

const recipeInjectedPayloadSchema = z.object({
    ...commonPayloadFields,
    recipeId: z.string().min(1),
    applicationId: z.string().min(1),
    injectedVia: z.enum(RECIPE_INJECTED_VIA),
}).strict();

/** kind별 payload 스키마이며, 여기 없는 kind는 인제스트에서 거부된다. */
export const payloadSchemaByKind: Record<string, z.ZodType> = {
    [KIND.tokenUsage]: telemetryPayloadSchema,
    [KIND.sessionStarted]: sessionStartedPayloadSchema,
    [KIND.sessionEnded]: sessionEndedPayloadSchema,
    [KIND.taskStart]: taskStartPayloadSchema,
    [KIND.taskLinked]: taskLinkedPayloadSchema,
    [KIND.taskComplete]: taskCompletePayloadSchema,
    [KIND.taskError]: taskErrorPayloadSchema,
    [KIND.recipeInjected]: recipeInjectedPayloadSchema,
    ...Object.fromEntries(TIMELINE_EVENT_KINDS.map((k) => [k, timelinePayloadSchema])),
};

export interface IngestEvent {
    readonly id: string;
    readonly kind: EventKind;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly parentId?: string;
    readonly turnId?: string;
    readonly occurredAt: string;
    readonly payload: Record<string, unknown>;
}

const KNOWN_KINDS = new Set<string>([...TIMELINE_EVENT_KINDS, ...TELEMETRY_EVENT_KINDS, KIND.sessionStarted,
    KIND.sessionEnded, KIND.taskStart, KIND.taskLinked, KIND.taskComplete, KIND.taskError, KIND.recipeInjected]);

export interface RejectedIngestEvent {
    readonly id: string;
    readonly reason: string;
}

export interface IngestBatchPartition {
    readonly accepted: IngestEvent[];
    readonly rejected: RejectedIngestEvent[];
}

/** 봉투 오류는 배치 전체를 거부하고, 개별 레코드 오류는 해당 레코드만 분리한다. */
export function parseIngestBatch(body: unknown): IngestBatchPartition {
    const batch = ingestBatchSchema.parse(body);
    const accepted: IngestEvent[] = [];
    const rejected: RejectedIngestEvent[] = [];

    for (const event of batch.events) {
        const schema = KNOWN_KINDS.has(event.kind) ? payloadSchemaByKind[event.kind] : undefined;
        if (!schema) {
            rejected.push({id: event.id, reason: `unknown event kind: ${event.kind}`});
            continue;
        }
        const parsed = schema.safeParse(event.payload);
        if (!parsed.success) {
            rejected.push({id: event.id, reason: parsed.error.issues[0]?.message ?? "invalid payload"});
            continue;
        }
        const payload = parsed.data as Record<string, unknown>;
        const violation = findJsonTextViolation(payload);
        if (violation !== null) {
            rejected.push({id: event.id, reason: violation});
            continue;
        }
        accepted.push({
            id: event.id,
            kind: event.kind as EventKind,
            taskId: event.taskId,
            ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
            ...(event.parentId !== undefined ? { parentId: event.parentId } : {}),
            ...(event.turnId !== undefined ? { turnId: event.turnId } : {}),
            occurredAt: event.occurredAt,
            payload,
        });
    }
    return {accepted, rejected};
}
