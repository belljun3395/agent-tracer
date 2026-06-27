import { z } from "zod";

export const recipeFileRoleSchema = z.enum(["read", "write", "both"]);

export const recipeStepSchema = z.object({
    order: z.number().int().min(1).max(50),
    action: z.string().trim().min(1).max(200),
    rationale: z.string().trim().max(300).optional(),
});

export const recipeTouchedFileSchema = z.object({
    path: z.string().trim().min(1).max(500),
    role: recipeFileRoleSchema,
});

export const recipeSliceSchema = z.object({
    taskId: z.string().trim().min(1),
    eventIds: z.array(z.string().trim().min(1)).max(200).default([]),
});

export const recipeCandidateSchema = z.object({
    title: z.string().trim().min(1).max(120),
    intent: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(400),
    summary_md: z.string().trim().min(1).max(4000),
    steps: z.array(recipeStepSchema).max(20).default([]),
    touched_files: z.array(recipeTouchedFileSchema).max(30).default([]),
    contributing_slices: z.array(recipeSliceSchema).min(1).max(20),
    rationale: z.string().trim().min(1).max(500),
});

export const recipeCandidatesListSchema = z.object({
    recipes: z.array(recipeCandidateSchema).max(50),
});

export type RecipeCandidatePayload = z.infer<typeof recipeCandidateSchema>;
export type RecipeCandidatesList = z.infer<typeof recipeCandidatesListSchema>;
export type RecipeSlicePayload = z.infer<typeof recipeSliceSchema>;
export type RecipeStepPayload = z.infer<typeof recipeStepSchema>;
export type RecipeTouchedFilePayload = z.infer<typeof recipeTouchedFileSchema>;
