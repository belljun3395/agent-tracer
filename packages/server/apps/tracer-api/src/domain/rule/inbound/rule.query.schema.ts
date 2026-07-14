import { z } from "zod";
import { RULES_ALL_FLAG, RULES_ALL_FLAG_VALUE } from "@monitor/kernel";

export const listRulesQuerySchema = z.object({
    taskId: z.string().optional(),
    // 태스크를 가리지 않고 이 사용자의 모든 규칙을 달라는 요청이다.
    [RULES_ALL_FLAG]: z.literal(RULES_ALL_FLAG_VALUE).optional(),
});

export const ruleEvidenceQuerySchema = z.object({ taskId: z.string().optional() });

export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>;
export type RuleEvidenceQuery = z.infer<typeof ruleEvidenceQuerySchema>;
