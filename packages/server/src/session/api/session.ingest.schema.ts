import { z } from "zod";
import { COMPLETION_REASONS } from "~application/tasks/common/task.constants.js";

export const runtimeSessionEnsureSchema = z.object({
    taskId: z.string().optional(),
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    resume: z.boolean().optional(),
});

export const runtimeSessionEndSchema = z.object({
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    summary: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(COMPLETION_REASONS).optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional(),
});
