import { z } from "zod";
import {
    RULE_EXPECTED_ACTIONS,
    RULE_SCOPES,
    RULE_SEVERITIES,
    RULE_SOURCES,
    RULE_TRIGGER_SOURCES,
} from "../domain/const/rule.const.js";

const triggerSchema = z.object({
    phrases: z.array(z.string().trim().min(1)).min(1),
});

const expectSchema = z.object({
    action: z.enum(RULE_EXPECTED_ACTIONS).optional(),
    commandMatches: z.array(z.string().trim().min(1)).min(1).optional(),
    pattern: z.string().trim().min(1).optional(),
});

export const ruleSuggestionIngestSchema = z
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
        const expect = value.expect;
        if (
            !expect.action &&
            !expect.pattern &&
            !(expect.commandMatches && expect.commandMatches.length > 0)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "expect must include at least one of action, pattern, or commandMatches",
                path: ["expect"],
            });
        }
    });

export type RuleSuggestionIngestBody = z.infer<typeof ruleSuggestionIngestSchema>;

export const rulesListIngestQuerySchema = z.object({
    scope: z.enum(RULE_SCOPES).optional(),
    taskId: z.string().trim().min(1).optional(),
    source: z.enum(RULE_SOURCES).optional(),
});

export type RulesListIngestQuery = z.infer<typeof rulesListIngestQuerySchema>;
