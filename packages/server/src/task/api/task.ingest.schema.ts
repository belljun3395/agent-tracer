import { z } from "zod";

const TASK_KINDS = ["primary", "background"] as const;

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
    metadata: z.record(z.unknown()).optional(),
});

export const taskLinkSchema = z.object({
    taskId: z.string().min(1),
    title: z.string().trim().min(1).optional(),
    taskKind: z.enum(TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional(),
});

export const taskCompleteSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    summary: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const taskErrorSchema = taskCompleteSchema.extend({
    errorMessage: z.string().min(1),
});
