import { RULE_SCOPES, RULE_SEVERITIES, RULE_TRIGGER_SOURCES } from "@monitor/kernel";
import { ruleExpectationSchema } from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import { z } from "zod";

const triggerSchema = z.object({ phrases: z.array(z.string().trim().min(1)).min(1) });

export const createRuleBodySchema = z.object({
    name: z.string().trim().min(1),
    trigger: triggerSchema.optional(),
    triggerOn: z.enum(RULE_TRIGGER_SOURCES).optional(),
    expect: ruleExpectationSchema,
    scope: z.enum(RULE_SCOPES),
    taskId: z.string().trim().min(1).optional(),
    severity: z.enum(RULE_SEVERITIES).optional(),
    rationale: z.string().trim().min(1).optional(),
    anchorEventId: z.string().trim().min(1).optional(),
});

export const updateRuleBodySchema = z.object({
    name: z.string().trim().min(1).optional(),
    trigger: triggerSchema.nullable().optional(),
    triggerOn: z.enum(RULE_TRIGGER_SOURCES).nullable().optional(),
    expect: ruleExpectationSchema.optional(),
    scope: z.enum(RULE_SCOPES).optional(),
    taskId: z.string().trim().min(1).optional(),
    severity: z.enum(RULE_SEVERITIES).optional(),
    rationale: z.string().trim().min(1).nullable().optional(),
});

export type CreateRuleBody = z.infer<typeof createRuleBodySchema>;
export type UpdateRuleBody = z.infer<typeof updateRuleBodySchema>;
