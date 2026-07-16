import { z } from "zod";
import { MEMO_AUTHORS } from "./memo.const.js";

export const MEMO_BODY_MAX_LENGTH = 4000;

const taskIdSchema = z.string().trim().min(1).max(64);
const eventIdSchema = z.string().trim().min(1).max(64);
const bodySchema = z.string().trim().min(1).max(MEMO_BODY_MAX_LENGTH);

export const createMemoSchema = z.object({
    taskId: taskIdSchema,
    eventId: eventIdSchema.optional(),
    body: bodySchema,
    author: z.enum(MEMO_AUTHORS),
}).strict();

export type CreateMemoPayload = z.infer<typeof createMemoSchema>;

export const updateMemoSchema = z.object({
    body: bodySchema,
}).strict();

export type UpdateMemoPayload = z.infer<typeof updateMemoSchema>;
