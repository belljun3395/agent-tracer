import { z } from "zod";
import { AI_JOB_STEP_ROLES } from "@monitor/kernel";

const toolCallSchema = z.object({
    id: z.string(),
    name: z.string(),
    args: z.record(z.unknown()),
});

// 실행 백엔드가 보내는 궤적 스텝이며 커널의 AiJobStepPayload와 필드가 1:1 대응한다.
const stepSchema = z.object({
    seq: z.number().int().nonnegative(),
    role: z.enum(AI_JOB_STEP_ROLES),
    content: z.string(),
    truncated: z.boolean(),
    toolCalls: z.array(toolCallSchema),
    toolName: z.string().optional(),
    toolCallId: z.string().optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    cacheReadTokens: z.number().int().nonnegative().optional(),
    cacheCreationTokens: z.number().int().nonnegative().optional(),
    stopReason: z.string().optional(),
});

const runCostSchema = z.object({
    usage: z.record(z.unknown()).optional(),
    modelUsed: z.string().trim().min(1).nullable().optional(),
    durationMs: z.number().finite().nonnegative().nullable().optional(),
    costUsd: z.number().finite().nonnegative().nullable().optional(),
    numTurns: z.number().int().nonnegative().nullable().optional(),
    steps: z.array(stepSchema).optional(),
});

export const resultsBodySchema = runCostSchema.extend({
    proposals: z.array(z.unknown()).optional(),
    result: z.record(z.unknown()).optional(),
});

/** 실패한 시도도 이미 비용을 청구했으므로 그 비용과 궤적을 결과 보고와 같은 모양으로 받는다. */
export const failBodySchema = runCostSchema.extend({ error: z.string().min(1) });

export type JobStepBody = z.infer<typeof stepSchema>;
export type RunCostBody = z.infer<typeof runCostSchema>;
export type ResultsBody = z.infer<typeof resultsBodySchema>;
export type FailBody = z.infer<typeof failBodySchema>;
