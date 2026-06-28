import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { RULE_EXPECTED_ACTIONS, RULE_SCOPES, RULE_SEVERITIES, RULE_TRIGGER_SOURCES } from "../domain/const/rule.const.js";
import { checkRuleInvariants } from "../domain/rule.invariants.js";
import type { RuleExpectInput } from "../domain/type/rule.expectation.input.js";

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
        // 입력 body의 expect.tool은 도메인 expect.action에 대응한다.
        const expect: RuleExpectInput = {
            ...(value.expect.tool !== undefined ? { action: value.expect.tool } : {}),
            ...(value.expect.commandMatches !== undefined ? { commandMatches: value.expect.commandMatches } : {}),
            ...(value.expect.pattern !== undefined ? { pattern: value.expect.pattern } : {}),
        };
        for (const violation of checkRuleInvariants({ scope: value.scope, taskId: value.taskId, expect })) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: violation.message, path: [violation.path] });
        }
    });

export type RuleCreateBody = z.infer<typeof ruleCreateSchema>;

export class RuleCreateDto extends createZodDto(ruleCreateSchema) {}

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

export class RuleUpdateDto extends createZodDto(ruleUpdateSchema) {}
