import { z } from "zod";
import { PLAYBOOK_STATUSES, WORKFLOW_RATINGS } from "~application/workflow/index.js";

function clampLimit(value: unknown, defaultValue: number, max: number): number {
    if (typeof value !== "string") return defaultValue;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return Math.min(Math.max(parsed, 1), max);
}

function optionalTrimmed(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

export const similarWorkflowQuerySchema = z.object({
    q: z.string().trim().min(1),
    tags: z.preprocess(optionalTrimmed, z.string().optional()).transform((value) =>
        value ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined,
    ),
    limit: z.preprocess((value) => clampLimit(value, 5, 10), z.number().int().min(1).max(10)),
});

export const workflowListQuerySchema = z.object({
    rating: z.preprocess(
        (value) => WORKFLOW_RATINGS.includes(value as (typeof WORKFLOW_RATINGS)[number])
            ? value
            : undefined,
        z.enum(WORKFLOW_RATINGS).optional(),
    ),
    q: z.preprocess(optionalTrimmed, z.string().optional()),
    limit: z.preprocess((value) => clampLimit(value, 50, 100), z.number().int().min(1).max(100)),
});

export const playbookListQuerySchema = z.object({
    q: z.preprocess(optionalTrimmed, z.string().optional()),
    status: z.preprocess(
        (value) => PLAYBOOK_STATUSES.includes(value as (typeof PLAYBOOK_STATUSES)[number])
            ? value
            : undefined,
        z.enum(PLAYBOOK_STATUSES).optional(),
    ),
    limit: z.preprocess((value) => clampLimit(value, 50, 100), z.number().int().min(1).max(100)),
});

export type SimilarWorkflowQuery = z.infer<typeof similarWorkflowQuerySchema>;
export type WorkflowListQuery = z.infer<typeof workflowListQuerySchema>;
export type PlaybookListQuery = z.infer<typeof playbookListQuerySchema>;
