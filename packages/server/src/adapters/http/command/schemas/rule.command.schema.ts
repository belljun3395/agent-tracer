import { z } from "zod";
import { RULE_EXPECTED_ACTIONS, RULE_SCOPES, RULE_SEVERITIES, RULE_TRIGGER_SOURCES } from "~domain/verification/rule/const/rule.const.js";

const triggerSchema = z.object({
    phrases: z.array(z.string().trim().min(1)).min(1),
});

const expectSchema = z.object({
    tool: z.enum(RULE_EXPECTED_ACTIONS).optional(),
    commandMatches: z.array(z.string().trim().min(1)).min(1).optional(),
    pattern: z.string().trim().min(1).optional(),
});

export const ruleCreateSchema = z
    .object({
        name: z.string().trim().min(1),
        trigger: triggerSchema.optional(),
        triggerOn: z.enum(RULE_TRIGGER_SOURCES).optional(),
        expect: expectSchema,
        scope: z.enum(RULE_SCOPES),
        taskId: z.string().trim().min(1).optional(),
        severity: z.enum(RULE_SEVERITIES).optional(),
        rationale: z.string().trim().min(1).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.scope === "task" && !value.taskId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Task-scoped rules require taskId",
                path: ["taskId"],
            });
        }
        if (value.scope === "global" && value.taskId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Global rules must not have taskId",
                path: ["taskId"],
            });
        }
        if (
            !value.expect.tool &&
            !value.expect.pattern &&
            !(value.expect.commandMatches && value.expect.commandMatches.length > 0)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "expect must include at least one of action, pattern, or commandMatches",
                path: ["expect"],
            });
        }
    });

export type RuleCreateBody = z.infer<typeof ruleCreateSchema>;

const expectPatchSchema = z.object({
    tool: z.enum(RULE_EXPECTED_ACTIONS).nullable().optional(),
    commandMatches: z.array(z.string().trim().min(1)).nullable().optional(),
    pattern: z.string().trim().min(1).nullable().optional(),
});

export const ruleUpdateSchema = z
    .object({
        name: z.string().trim().min(1).optional(),
        trigger: triggerSchema.nullable().optional(),
        triggerOn: z.enum(RULE_TRIGGER_SOURCES).nullable().optional(),
        expect: expectPatchSchema.optional(),
        severity: z.enum(RULE_SEVERITIES).optional(),
        rationale: z.string().trim().min(1).nullable().optional(),
    })
    .refine(
        (value) =>
            value.name !== undefined ||
            value.trigger !== undefined ||
            value.triggerOn !== undefined ||
            value.expect !== undefined ||
            value.severity !== undefined ||
            value.rationale !== undefined,
        { message: "At least one field must be provided to update" },
    );

export type RuleUpdateBody = z.infer<typeof ruleUpdateSchema>;
