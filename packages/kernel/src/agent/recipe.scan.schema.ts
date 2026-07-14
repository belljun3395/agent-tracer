import { z } from "zod";
import { RECIPE_CANDIDATE_LIMIT } from "./agent.const.js";

// 어느 백엔드로 실행하든 최종 심판이 되는 recipe-scan 에이전트의 구조화 출력이다.

// 모델이 없는 값을 null로 채워 보내므로 받아서 undefined로 되돌린다.
function structuredOptional<T extends z.ZodTypeAny>(schema: T) {
    return schema.nullish().transform((value): z.output<T> | undefined => value ?? undefined);
}

export const recipeFileRoleSchema = z.enum(["read", "write", "both"]);

export const recipeStepSchema = z.object({
    order: z.number().int().min(1).max(50),
    action: z.string().trim().min(1).max(200),
    rationale: structuredOptional(z.string().trim().max(300)),
});

export const recipeTouchedFileSchema = z.object({
    path: z.string().trim().min(1).max(500),
    role: recipeFileRoleSchema,
});

export const recipeSliceSchema = z.object({
    taskId: z.string().trim().min(1),
    turnIds: z.array(z.string().trim().min(1)).max(50).default([]),
    eventIds: z.array(z.string().trim().min(1)).max(200).default([]),
});

// 근거 없는 지적은 검증할 수 없는 주장이라 최소 하나의 근거 이벤트를 강제한다.
export const recipeCorrectionSchema = z.object({
    whatAgentDid: z.string().trim().min(1).max(500),
    howCorrected: z.string().trim().min(1).max(500),
    evidence: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const recipePitfallSchema = z.object({
    pitfall: z.string().trim().min(1).max(500),
    whyNonObvious: z.string().trim().min(1).max(500),
    evidence: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const recipeCandidateSchema = z.object({
    title: z.string().trim().min(1).max(120),
    intent: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(400),
    summary_md: z.string().trim().min(1).max(4000),
    request: z.string().trim().min(1).max(2000),
    corrections: z.array(recipeCorrectionSchema).max(20).default([]),
    pitfalls: z.array(recipePitfallSchema).max(20).default([]),
    governing_rules: z.array(z.string().trim().min(1)).max(50).default([]),
    revises_recipe_id: structuredOptional(z.string().trim().min(1).max(200)),
    steps: z.array(recipeStepSchema).max(20).default([]),
    touched_files: z.array(recipeTouchedFileSchema).max(30).default([]),
    contributing_slices: z.array(recipeSliceSchema).min(1).max(20),
    rationale: z.string().trim().min(1).max(500),
});

export const recipeCandidatesListSchema = z.object({
    recipes: z.array(recipeCandidateSchema).max(RECIPE_CANDIDATE_LIMIT).default([]),
});

export type RecipeCandidatePayload = z.infer<typeof recipeCandidateSchema>;
export type RecipeCandidatesList = z.infer<typeof recipeCandidatesListSchema>;
export type RecipeCorrectionPayload = z.infer<typeof recipeCorrectionSchema>;
export type RecipePitfallPayload = z.infer<typeof recipePitfallSchema>;
export type RecipeSlicePayload = z.infer<typeof recipeSliceSchema>;
export type RecipeStepPayload = z.infer<typeof recipeStepSchema>;
export type RecipeTouchedFilePayload = z.infer<typeof recipeTouchedFileSchema>;
