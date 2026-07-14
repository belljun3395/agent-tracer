import { RULE_SEVERITIES } from "@monitor/kernel";
import { ruleExpectationSchema } from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import { z } from "zod";

export const createRuleBodySchema = z.object({
    name: z.string().trim().min(1),
    expect: ruleExpectationSchema,
    taskId: z.string().trim().min(1),
    // 규칙을 낳은 사용자 입력이며 판정 창이 여기서 시작한다.
    anchorEventId: z.string().trim().min(1),
    severity: z.enum(RULE_SEVERITIES).optional(),
    rationale: z.string().trim().min(1).optional(),
});

export const updateRuleBodySchema = z.object({
    name: z.string().trim().min(1).optional(),
    expect: ruleExpectationSchema.optional(),
    severity: z.enum(RULE_SEVERITIES).optional(),
    rationale: z.string().trim().min(1).nullable().optional(),
});

export type CreateRuleBody = z.infer<typeof createRuleBodySchema>;
export type UpdateRuleBody = z.infer<typeof updateRuleBodySchema>;
