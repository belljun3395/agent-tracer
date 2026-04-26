import { z } from "zod";

export const createRuleBodySchema = z
    .object({
        name: z.string().min(1),
        trigger: z.object({ phrases: z.array(z.string().min(1)).min(1) }).optional(),
        triggerOn: z.enum(["assistant", "user"]).optional(),
        expect: z.object({
            tool: z.string().optional(),
            commandMatches: z.array(z.string()).optional(),
            pattern: z.string().optional(),
        }),
        scope: z.enum(["global", "task"]),
        taskId: z.string().min(1).optional(),
        severity: z.enum(["info", "warn", "block"]).optional(),
    })
    .refine(
        (d) => d.scope !== "task" || !!d.taskId,
        { message: "task scope requires taskId" },
    )
    .refine(
        (d) => d.scope !== "global" || !d.taskId,
        { message: "global scope must not include taskId" },
    )
    .refine(
        (d) =>
            d.expect.tool !== undefined ||
            d.expect.pattern !== undefined ||
            (Array.isArray(d.expect.commandMatches) && d.expect.commandMatches.length > 0),
        { message: "expect must include tool, pattern, or non-empty commandMatches" },
    );
export type CreateRuleBody = z.infer<typeof createRuleBodySchema>;

export const updateRuleBodySchema = z
    .object({
        name: z.string().min(1).optional(),
        trigger: z
            .union([
                z.object({ phrases: z.array(z.string().min(1)).min(1) }),
                z.null(),
            ])
            .optional(),
        triggerOn: z.union([z.enum(["assistant", "user"]), z.null()]).optional(),
        expect: z
            .object({
                tool: z.union([z.string(), z.null()]).optional(),
                commandMatches: z.union([z.array(z.string()), z.null()]).optional(),
                pattern: z.union([z.string(), z.null()]).optional(),
            })
            .optional(),
        severity: z.enum(["info", "warn", "block"]).optional(),
    })
    .refine(
        (d) => Object.values(d).some((v) => v !== undefined),
        { message: "at least one field required" },
    );
export type UpdateRuleBody = z.infer<typeof updateRuleBodySchema>;

export const promoteRuleBodySchema = z
    .object({
        name: z.string().min(1),
        trigger: z.object({ phrases: z.array(z.string().min(1)).min(1) }).optional(),
        expect: z.object({
            tool: z.string().optional(),
            commandMatches: z.array(z.string()).optional(),
            pattern: z.string().optional(),
        }),
        severity: z.enum(["info", "warn", "block"]),
        rationale: z.string().optional(),
    })
    .refine(
        (d) =>
            d.expect.tool !== undefined ||
            d.expect.pattern !== undefined ||
            (Array.isArray(d.expect.commandMatches) && d.expect.commandMatches.length > 0),
        { message: "expect must include tool, pattern, or non-empty commandMatches" },
    );
export type PromoteRuleBody = z.infer<typeof promoteRuleBodySchema>;
