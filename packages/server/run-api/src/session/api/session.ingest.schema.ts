import { z } from "zod";
import {
    TASK_COMPLETION_REASONS,
    TASK_ORIGINS,
} from "@monitor/run-api/task/common/task.status.const.js";

export const runtimeSessionEnsureSchema = z.object({
    taskId: z.string().optional(),
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    origin: z.enum(TASK_ORIGINS).optional(),
    resume: z.boolean().optional(),
});

export const runtimeSessionEndSchema = z.object({
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    summary: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(TASK_COMPLETION_REASONS).optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional(),
});
