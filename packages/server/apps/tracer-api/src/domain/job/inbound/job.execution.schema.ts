import { z } from "zod";

export const resultsBodySchema = z.object({
    proposals: z.array(z.unknown()).optional(),
    result: z.record(z.unknown()).optional(),
    usage: z.record(z.unknown()).optional(),
    modelUsed: z.string().trim().min(1).optional(),
    durationMs: z.number().finite().nonnegative().optional(),
    costUsd: z.number().finite().nonnegative().nullable().optional(),
    numTurns: z.number().int().nonnegative().nullable().optional(),
});

export const failBodySchema = z.object({ error: z.string().min(1) });

export type ResultsBody = z.infer<typeof resultsBodySchema>;
export type FailBody = z.infer<typeof failBodySchema>;
