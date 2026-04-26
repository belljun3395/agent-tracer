import { z } from "zod";

export const suggestRuleBodySchema = z
    .object({
        trigger: z.object({
            phrases: z.array(z.string().min(1)).min(1),
        }).optional(),
        triggerOn: z.enum(["assistant", "user"]).optional(),
        expect: z.object({
            tool: z.string().min(1).optional(),
            commandMatches: z.array(z.string()).optional(),
            pattern: z.string().optional(),
        }),
        rationale: z.string(),
        severity: z.enum(["info", "warn", "block"]).optional(),
        name: z.string().optional(),
        taskId: z.string().min(1),
    })
    .refine(
        (d) =>
            d.expect.tool !== undefined ||
            d.expect.pattern !== undefined ||
            (Array.isArray(d.expect.commandMatches) && d.expect.commandMatches.length > 0),
        { message: "expect must include tool, pattern, or non-empty commandMatches" },
    );

export type SuggestRuleBody = z.infer<typeof suggestRuleBodySchema>;
