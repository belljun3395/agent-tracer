import { z } from "zod";

export const listRulesQuerySchema = z.object({
    taskId: z.string().optional(),
    scope: z.literal("all").optional(),
});

export const ruleEvidenceQuerySchema = z.object({ taskId: z.string().optional() });

export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>;
export type RuleEvidenceQuery = z.infer<typeof ruleEvidenceQuerySchema>;
