import { z } from "zod";

export const createRuleCommandSchema = z.object({
    pattern: z.string().min(1),
    label: z.string().min(1),
});
