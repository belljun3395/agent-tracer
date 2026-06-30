import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
    RULE_EXPECTED_ACTIONS,
    RULE_SCOPES,
    RULE_SEVERITIES,
    RULE_SOURCES,
    RULE_TRIGGER_SOURCES,
} from "../../domain/rule/const/rule.const.js";
import { checkRuleInvariants } from "../../domain/rule/rule.invariants.policy.js";

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
        const expect = {
            ...(value.expect.action !== undefined ? { action: value.expect.action } : {}),
            ...(value.expect.commandMatches !== undefined ? { commandMatches: value.expect.commandMatches } : {}),
            ...(value.expect.pattern !== undefined ? { pattern: value.expect.pattern } : {}),
        };
        for (const violation of checkRuleInvariants({ scope: value.scope, taskId: value.taskId, expect })) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: violation.message, path: [violation.path] });
        }
    });

export type RuleSuggestionIngestBody = z.infer<typeof ruleSuggestionIngestSchema>;

export class RuleSuggestionIngestDto extends createZodDto(ruleSuggestionIngestSchema) {}

export const rulesListIngestQuerySchema = z.object({
    scope: z.enum(RULE_SCOPES).optional(),
    taskId: z.string().trim().min(1).optional(),
    source: z.enum(RULE_SOURCES).optional(),
});

export type RulesListIngestQuery = z.infer<typeof rulesListIngestQuerySchema>;

export class RulesListIngestQueryDto extends createZodDto(rulesListIngestQuerySchema) {}
