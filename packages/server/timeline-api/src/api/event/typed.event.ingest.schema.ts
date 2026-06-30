import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
    CONVERSATION_EVENT_KINDS,
    COORDINATION_EVENT_KINDS,
    EVENT_LANES,
    EVENT_RELATION_TYPES,
    LIFECYCLE_EVENT_KINDS,
    TELEMETRY_EVENT_KINDS,
    TOOL_ACTIVITY_EVENT_KINDS,
    WORKFLOW_EVENT_KINDS,
} from "@monitor/timeline-api/application/event/dto/event.recording.dto.js";

const baseEventSchema = z.object({
    id: z.string().min(1),
    kind: z.string().min(1),
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

const toolActivityEventSchema = baseEventSchema.extend({
    kind: z.enum(TOOL_ACTIVITY_EVENT_KINDS),
});
const workflowEventSchema = baseEventSchema.extend({
    kind: z.enum(WORKFLOW_EVENT_KINDS),
});
const conversationEventSchema = baseEventSchema.extend({
    kind: z.enum(CONVERSATION_EVENT_KINDS),
});
const coordinationEventSchema = baseEventSchema.extend({
    kind: z.enum(COORDINATION_EVENT_KINDS),
});
const lifecycleEventSchema = baseEventSchema.extend({
    kind: z.enum(LIFECYCLE_EVENT_KINDS),
});
const telemetryValuesSchema = z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative().default(0),
    cacheCreateTokens: z.number().int().nonnegative().default(0),
    costUsd: z.number().nonnegative().optional(),
    durationMs: z.number().nonnegative().optional(),
    model: z.string().optional(),
    promptId: z.string().optional(),
});

const telemetryEventSchema = z.object({
    id: z.string().min(1),
    kind: z.enum(TELEMETRY_EVENT_KINDS).optional(),
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    metadata: telemetryValuesSchema.optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    cacheReadTokens: z.number().int().nonnegative().optional(),
    cacheCreateTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
    durationMs: z.number().nonnegative().optional(),
    model: z.string().optional(),
    promptId: z.string().optional(),
}).transform((event) => {
    const values = event.metadata ?? telemetryValuesSchema.parse(event);
    return {
        id: event.id,
        kind: TELEMETRY_EVENT_KINDS[0],
        taskId: event.taskId,
        ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
        ...values,
    };
});

export const toolActivityBatchSchema = z.object({ events: z.array(toolActivityEventSchema).min(1).max(100) });
export const workflowBatchSchema = z.object({ events: z.array(workflowEventSchema).min(1).max(100) });
export const conversationBatchSchema = z.object({ events: z.array(conversationEventSchema).min(1).max(100) });
export const coordinationBatchSchema = z.object({ events: z.array(coordinationEventSchema).min(1).max(100) });
export const lifecycleBatchSchema = z.object({ events: z.array(lifecycleEventSchema).min(1).max(100) });
export const telemetryBatchSchema = z.object({ events: z.array(telemetryEventSchema).min(1).max(100) });

export class ToolActivityBatchDto extends createZodDto(toolActivityBatchSchema) {}

export class WorkflowBatchDto extends createZodDto(workflowBatchSchema) {}

export class ConversationBatchDto extends createZodDto(conversationBatchSchema) {}

export class CoordinationBatchDto extends createZodDto(coordinationBatchSchema) {}

export class LifecycleBatchDto extends createZodDto(lifecycleBatchSchema) {}

export class TelemetryBatchDto extends createZodDto(telemetryBatchSchema) {}

export type ToolActivityIngestEvent = z.infer<typeof toolActivityEventSchema>;
export type WorkflowIngestEvent = z.infer<typeof workflowEventSchema>;
export type ConversationIngestEvent = z.infer<typeof conversationEventSchema>;
export type CoordinationIngestEvent = z.infer<typeof coordinationEventSchema>;
export type LifecycleIngestEvent = z.infer<typeof lifecycleEventSchema>;
