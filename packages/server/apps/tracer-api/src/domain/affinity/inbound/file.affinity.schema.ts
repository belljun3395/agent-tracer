import { z } from "zod";

export const fileAffinityQuerySchema = z.object({
    intent: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

export type FileAffinityQuery = z.infer<typeof fileAffinityQuerySchema>;
