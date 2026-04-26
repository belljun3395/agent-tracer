import { z } from "zod";
import { PLAYBOOK_STATUSES } from "~application/workflow/index.js";
import { clampLimit, optionalTrimmed } from "~adapters/http/shared/schemas/query.schema.js";

export const playbookListQuerySchema = z.object({
    q: z.preprocess(optionalTrimmed, z.string().optional()),
    status: z.preprocess(
        (value) => PLAYBOOK_STATUSES.includes(value as (typeof PLAYBOOK_STATUSES)[number])
            ? value
            : undefined,
        z.enum(PLAYBOOK_STATUSES).optional(),
    ),
    limit: z.preprocess((value) => clampLimit(value, 50, 100), z.number().int().min(1).max(100)),
});

export type PlaybookListQuery = z.infer<typeof playbookListQuerySchema>;
