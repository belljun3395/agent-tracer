import { z } from "zod";

export const searchQuerySchema = z.object({
    q: z.string().trim().min(1).optional(),
    query: z.string().trim().min(1).optional(),
    taskId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
}).refine((data) => data.query !== undefined || data.q !== undefined, {
    message: "q parameter is required",
    path: ["q"],
}).transform(({ q, query, taskId, limit }) => ({
    query: query ?? q ?? "",
    ...(taskId !== undefined ? { taskId } : {}),
    ...(limit !== undefined ? { limit } : {}),
}));
