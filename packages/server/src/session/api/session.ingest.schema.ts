import { z } from "zod";

/**
 * Reasons a runtime session can end. Declared locally so the session module's
 * inbound contract isn't coupled to task module's domain types — even though
 * the values currently match the legacy task-domain enum, future evolution
 * should be driven by session module's own needs.
 */
const RUNTIME_SESSION_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

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
    completionReason: z.enum(RUNTIME_SESSION_COMPLETION_REASONS).optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional(),
});
