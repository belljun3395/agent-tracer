import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { EVENT_LANES, EVENT_RELATION_TYPES, INGEST_EVENT_KINDS } from "@monitor/timeline-api/application/event/dto/event.recording.dto.js";

// 혼합 kind를 받는 범용 ingest 입구. id는 선택(서버 엣지에서 ULID 스탬프)이다.
const eventBatchItemSchema = z.object({
    id: z.string().min(1).optional(),
    kind: z.enum(INGEST_EVENT_KINDS),
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    lane: z.enum(EVENT_LANES),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    parentEventId: z.string().min(1).optional(),
    relatedEventIds: z.array(z.string().min(1)).optional(),
    relationType: z.enum(EVENT_RELATION_TYPES).optional(),
    relationLabel: z.string().min(1).optional(),
    relationExplanation: z.string().min(1).optional(),
    createdAt: z.string().optional(),
    taskEffects: z.object({ taskStatus: z.enum(["running", "waiting", "completed", "errored"]).optional() }).optional(),
});

export const eventBatchSchema = z.object({
    events: z.array(eventBatchItemSchema).min(1).max(100),
});

export class EventBatchDto extends createZodDto(eventBatchSchema) {}

export type EventBatchItem = z.infer<typeof eventBatchItemSchema>;
