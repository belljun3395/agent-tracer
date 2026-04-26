import { z } from "zod";
import { WORKFLOW_RATINGS } from "~application/workflow/index.js";
import { clampLimit, optionalTrimmed } from "~adapters/http/shared/schemas/query.schema.js";

export const workflowListQuerySchema = z.object({
    rating: z.preprocess(
        (value) => WORKFLOW_RATINGS.includes(value as (typeof WORKFLOW_RATINGS)[number])
            ? value
            : undefined,
        z.enum(WORKFLOW_RATINGS).optional(),
    ),
    q: z.preprocess(optionalTrimmed, z.string().optional()),
    limit: z.preprocess((value) => clampLimit(value, 50, 100), z.number().int().min(1).max(100)),
});

export type WorkflowListQuery = z.infer<typeof workflowListQuerySchema>;
