import { z } from "zod";

export const VerdictCountsDto = z.object({
    contradicted: z.number().int().nonnegative(),
});

export const StatusLineQuerySchema = z.object({
    sessionId: z.string().min(1).optional(),
});

export type StatusLineQuery = z.infer<typeof StatusLineQuerySchema>;
