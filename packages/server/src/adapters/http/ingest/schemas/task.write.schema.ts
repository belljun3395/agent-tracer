import { z } from "zod";
import { COMPLETION_REASONS, TASK_KINDS, TASK_STATUSES } from "./write.schema.const.js";
export const taskStartSchema = z.object({
    taskId: z.string().optional(),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    runtimeSource: z.string().min(1).optional(),
    summary: z.string().optional(),
    taskKind: z.enum(TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
export const taskLinkSchema = z.object({
    taskId: z.string().min(1),
    title: z.string().trim().min(1).optional(),
    taskKind: z.enum(TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional()
});
export const taskCompleteSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    summary: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
export const taskPatchSchema = z.object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional()
}).refine((data) => data.title !== undefined || data.status !== undefined, { message: "At least one of title or status must be provided" });
export const taskErrorSchema = taskCompleteSchema.extend({
    errorMessage: z.string().min(1)
});
export const sessionEndSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(COMPLETION_REASONS).optional(),
    summary: z.string().optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.unknown()).optional()
});
export const bookmarkSchema = z.object({
    taskId: z.string().min(1),
    eventId: z.string().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    note: z.string().trim().min(1).optional(),
    metadata: z.record(z.unknown()).optional()
});
export const searchSchema = z.object({
    query: z.string().trim().min(1),
    taskId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
});
export const runtimeSessionEnsureSchema = z.object({
    taskId: z.string().optional(),
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional()
});
export const runtimeSessionEndSchema = z.object({
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    summary: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(COMPLETION_REASONS).optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional()
});
