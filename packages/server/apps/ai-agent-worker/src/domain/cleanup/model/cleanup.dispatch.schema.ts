import { z } from "zod";
import { TASK_CLEANUP_MAX_SUGGESTIONS } from "@monitor/kernel";
import { cleanupSuggestionsListSchema } from "@monitor/kernel/agent/task.cleanup.schema.js";

// SDK 백엔드가 조사를 조율자와 후보별 조사로 나눌 때만 쓰는 내부 계획·보고 스키마이며, 커널 계약이
// 잠그는 도구·출력·예산 계약과는 분리된 오케스트레이션 지식이다.

export const MAX_INSPECT_WEIGHT = 4;
export const MAX_INSPECT_EXCERPTS = 6;
export const MAX_INSPECT_REASON_CHARS = 400;

// 조율자가 결정 대신 후보를 다시 열어보게 할 수 있는 라운드 수이며 무한 루프를 이 값으로 막는다.
export const MAX_REDISPATCH_ROUNDS = 1;

export const inspectAssignmentSchema = z.object({
    taskId: z.string().trim().min(1),
    weight: z.number().int().min(1).max(MAX_INSPECT_WEIGHT),
});

// 계획이 비면(inspect: []) 후보를 아무도 열어보지 않고 조율자가 목록만 보고 결정한다.
export const triagePlanSchema = z.object({
    inspect: z.array(inspectAssignmentSchema).max(TASK_CLEANUP_MAX_SUGGESTIONS).default([]),
});

export const inspectReportSchema = z.object({
    taskId: z.string().trim().min(1),
    archivable: z.boolean(),
    reason: z.string().trim().min(1).max(MAX_INSPECT_REASON_CHARS),
    citedEventIds: z.array(z.string().trim().min(1)).max(MAX_INSPECT_EXCERPTS).default([]),
});

export const cleanupDecisionSchema = cleanupSuggestionsListSchema.extend({
    redispatch: z.array(inspectAssignmentSchema).max(TASK_CLEANUP_MAX_SUGGESTIONS).default([]),
});

export type InspectAssignment = z.infer<typeof inspectAssignmentSchema>;
export type TriagePlan = z.infer<typeof triagePlanSchema>;
export type InspectReport = z.infer<typeof inspectReportSchema>;
export type CleanupDecision = z.infer<typeof cleanupDecisionSchema>;

export function totalPlanWeight(plan: TriagePlan): number {
    return plan.inspect.reduce((sum, assignment) => sum + assignment.weight, 0);
}
