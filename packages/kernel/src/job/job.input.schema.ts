import { z } from "zod";
import {
    JOB_KIND,
    RECIPE_SCAN_TRIGGER,
    RULE_GENERATION_FOCUS,
    RULE_GENERATION_INTENT_MAX_LENGTH,
    type JobKind,
} from "./job.const.js";

// 잡 입력이 워크플로 인자로 그대로 흘러가므로 종류마다 허용 필드를 못박는다.

const taskIdSchema = z.string().trim().min(1).max(64);

export const titleSuggestionJobInputSchema = z.object({
    taskId: taskIdSchema,
}).strict();

export const recipeScanJobInputSchema = z.object({
    taskId: taskIdSchema,
    userPrompt: z.string().trim().min(1).max(4000).optional(),
    language: z.string().trim().min(1).max(16).optional(),
    trigger: z.enum([RECIPE_SCAN_TRIGGER.dashboard, RECIPE_SCAN_TRIGGER.session]).optional(),
}).strict();

export const taskCleanupJobInputSchema = z.object({
    filters: z.object({
        maxSuggestions: z.number().int().positive().max(50).optional(),
    }).strict().optional(),
}).strict();

export const ruleGenerationJobInputSchema = z.object({
    taskId: taskIdSchema,
    // 규칙이 매달릴 근거 입력이며 판정은 이 입력 이후의 이벤트만 본다.
    anchorEventId: z.string().trim().min(1).max(64).optional(),
    focus: z.enum([RULE_GENERATION_FOCUS.recent]).optional(),
    maxRules: z.number().int().positive().max(20).optional(),
    intent: z.string().trim().min(1).max(RULE_GENERATION_INTENT_MAX_LENGTH).optional(),
}).strict();

export const JOB_INPUT_SCHEMA_BY_KIND = {
    [JOB_KIND.titleSuggestion]: titleSuggestionJobInputSchema,
    [JOB_KIND.recipeScan]: recipeScanJobInputSchema,
    [JOB_KIND.taskCleanup]: taskCleanupJobInputSchema,
    [JOB_KIND.ruleGeneration]: ruleGenerationJobInputSchema,
} as const satisfies Record<JobKind, z.ZodTypeAny>;

export type JobInputByKind = {
    readonly [K in JobKind]: z.infer<(typeof JOB_INPUT_SCHEMA_BY_KIND)[K]>;
};

export function jobInputSchemaFor(kind: JobKind): (typeof JOB_INPUT_SCHEMA_BY_KIND)[JobKind] {
    return JOB_INPUT_SCHEMA_BY_KIND[kind];
}
