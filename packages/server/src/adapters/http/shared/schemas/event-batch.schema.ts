import { z } from "zod";
import { EVENT_LANES, EVENT_RELATION_TYPES, INGEST_EVENT_KINDS } from "~application/events/index.js";

export const eventBatchItemSchema = z.object({
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
    taskEffects: z.object({ taskStatus: z.string().optional() }).optional(),
});

export const eventBatchSchema = z.object({
    events: z.array(eventBatchItemSchema).min(1).max(100),
});
