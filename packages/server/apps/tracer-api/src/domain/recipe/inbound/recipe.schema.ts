import { z } from "zod";
import { RECIPE_OUTCOMES, RECIPE_STATUSES } from "@monitor/kernel";

export const listQuerySchema = z.object({ status: z.enum(RECIPE_STATUSES).optional() });
export const applicationsQuerySchema = z.object({ recipeId: z.string().trim().min(1) });
export const editBodySchema = z.object({
    title: z.string().trim().min(1).max(120).optional(),
    intent: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(400).optional(),
    summaryMd: z.string().trim().min(1).max(4000).optional(),
}).refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });
export const outcomeBodySchema = z.object({
    taskId: z.string().trim().min(1),
    outcome: z.enum(RECIPE_OUTCOMES),
    note: z.string().trim().min(1).max(2000).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type ApplicationsQuery = z.infer<typeof applicationsQuerySchema>;
export type EditBody = z.infer<typeof editBodySchema>;
export type OutcomeBody = z.infer<typeof outcomeBodySchema>;
