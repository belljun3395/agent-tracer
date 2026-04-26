import { z } from "zod";
import type {
    TurnCardView,
    TurnEventView,
    TurnReceiptView,
    TurnVerdictView,
    VerdictFilter,
} from "~domain/verification/index.js";
import { VERDICT_STATUSES } from "~domain/verification/index.js";

/**
 * Zod schemas for the HTTP layer. The response types
 * (`TurnCardDto`/`TurnReceiptDto`/...) are aliased to the domain view types,
 * so adapters and use cases share a single shape contract — the schemas
 * exist purely to validate inbound query/body shapes.
 */

export const VerdictStatusSchema = z.enum(VERDICT_STATUSES);
export type VerdictStatusDto = z.infer<typeof VerdictStatusSchema>;

export const VerdictFilterSchema = z.enum(["all", ...VERDICT_STATUSES]);
export type { VerdictFilter };

const turnVerdictCountShape = z.object({
    verified: z.number().int().nonnegative(),
    unverifiable: z.number().int().nonnegative(),
    contradicted: z.number().int().nonnegative(),
});

export const TurnCardSchema = z.object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    taskId: z.string().min(1),
    index: z.number().int().nonnegative(),
    taskIndex: z.number().int().positive().default(1),
    startedAt: z.string(),
    endedAt: z.string(),
    askedText: z.string().nullable(),
    assistantText: z.string(),
    aggregateVerdict: VerdictStatusSchema.nullable(),
    eventCount: z.number().int().nonnegative(),
    verdictCount: turnVerdictCountShape,
    rulesEvaluatedCount: z.number().int().nonnegative().default(0),
    previewLines: z.array(z.string()),
});
export type TurnCardDto = TurnCardView;

export const TurnEventSchema = z.object({
    id: z.string(),
    kind: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    occurredAt: z.string(),
    metadata: z.record(z.unknown()).optional(),
});
export type TurnEventDto = TurnEventView;

export const TurnVerdictSchema = z.object({
    id: z.string(),
    ruleId: z.string(),
    status: VerdictStatusSchema,
    matchedPhrase: z.string().nullable(),
    expectedPattern: z.string().nullable(),
    actualToolCalls: z.array(z.string()),
    matchedToolCalls: z.array(z.string()).nullable(),
    evaluatedAt: z.string(),
});
export type TurnVerdictDto = TurnVerdictView;

export const TurnReceiptSchema = z.object({
    card: TurnCardSchema,
    askedText: z.string().nullable(),
    verdicts: z.array(TurnVerdictSchema),
    events: z.array(TurnEventSchema),
    summaryMarkdown: z.string().nullable().default(null),
});
export type TurnReceiptDto = TurnReceiptView;

export const ListTurnsQuerySchema = z.object({
    sessionId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional(),
    verdict: VerdictFilterSchema.optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    cursor: z.string().min(1).optional(),
});
export type ListTurnsQuery = z.infer<typeof ListTurnsQuerySchema>;
