import { z } from "zod";

export const searchQuerySchema = z.object({
    query: z.string().trim().min(1),
    taskId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});
