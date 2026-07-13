import { z } from "zod";

export const reevaluateRuleBodySchema = z.object({ taskId: z.string().trim().min(1).optional() }).optional();

export type ReevaluateRuleBody = z.infer<typeof reevaluateRuleBodySchema>;
