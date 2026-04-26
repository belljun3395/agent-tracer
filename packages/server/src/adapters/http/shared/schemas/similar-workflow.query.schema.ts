import { z } from "zod";
import { clampLimit, optionalTrimmed } from "./query.schema.js";

export const similarWorkflowQuerySchema = z.object({
    q: z.string().trim().min(1),
    tags: z.preprocess(optionalTrimmed, z.string().optional()).transform((value) =>
        value ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined,
    ),
    limit: z.preprocess((value) => clampLimit(value, 5, 10), z.number().int().min(1).max(10)),
});

export type SimilarWorkflowQuery = z.infer<typeof similarWorkflowQuerySchema>;
