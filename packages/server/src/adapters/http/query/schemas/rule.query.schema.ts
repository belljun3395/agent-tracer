import { z } from "zod";
import {
    RULE_SCOPES,
    RULE_SOURCES,
} from "~domain/verification/index.js";

export const rulesListQuerySchema = z.object({
    scope: z.enum(RULE_SCOPES).optional(),
    taskId: z.string().trim().min(1).optional(),
    source: z.enum(RULE_SOURCES).optional(),
});

export type RulesListQuery = z.infer<typeof rulesListQuerySchema>;
