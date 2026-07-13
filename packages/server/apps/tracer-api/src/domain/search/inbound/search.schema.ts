import { z } from "zod";

export const taskSearchQuerySchema = z.object({
    q: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

export const eventSearchQuerySchema = z.object({
    q: z.string().optional(),
    taskId: z.string().optional(),
    kind: z.string().optional(),
    lane: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

export type TaskSearchQuery = z.infer<typeof taskSearchQuerySchema>;
export type EventSearchQuery = z.infer<typeof eventSearchQuerySchema>;
