import { z } from "zod";
import {
    BRIEFING_FORMATS,
    BRIEFING_PURPOSES,
    PLAYBOOK_STATUSES,
    WORKFLOW_RATINGS,
} from "~domain/index.js";

const playbookVariantSchema = z.object({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    differenceFromBase: z.string().trim().min(1),
});

export const playbookUpsertSchema = z.object({
    title: z.string().trim().min(1),
    status: z.enum(PLAYBOOK_STATUSES).optional(),
    whenToUse: z.string().trim().min(1).nullable().optional(),
    prerequisites: z.array(z.string().trim().min(1)).optional(),
    approach: z.string().trim().min(1).nullable().optional(),
    keySteps: z.array(z.string().trim().min(1)).optional(),
    watchouts: z.array(z.string().trim().min(1)).optional(),
    antiPatterns: z.array(z.string().trim().min(1)).optional(),
    failureModes: z.array(z.string().trim().min(1)).optional(),
    variants: z.array(playbookVariantSchema).optional(),
    relatedPlaybookIds: z.array(z.string().trim().min(1)).optional(),
    sourceSnapshotIds: z.array(z.string().trim().min(1)).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
});

export const playbookPatchSchema = playbookUpsertSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one playbook field must be provided" },
);

export const briefingSaveSchema = z.object({
    purpose: z.enum(BRIEFING_PURPOSES),
    format: z.enum(BRIEFING_FORMATS),
    memo: z.string().optional(),
    content: z.string().min(1),
    generatedAt: z.string().min(1),
});

const reusableTaskSnapshotSchema = z.object({
    objective: z.string(),
    originalRequest: z.string().nullable(),
    outcomeSummary: z.string().nullable(),
    approachSummary: z.string().nullable(),
    reuseWhen: z.string().nullable(),
    watchItems: z.array(z.string()),
    keyDecisions: z.array(z.string()),
    nextSteps: z.array(z.string()),
    keyFiles: z.array(z.string()),
    modifiedFiles: z.array(z.string()),
    verificationSummary: z.string().nullable(),
    activeInstructions: z.array(z.string()),
    searchText: z.string(),
});

export const taskEvaluateSchema = z.object({
    rating: z.enum(WORKFLOW_RATINGS),
    useCase: z.string().optional(),
    workflowTags: z.array(z.string()).optional(),
    outcomeNote: z.string().optional(),
    approachNote: z.string().optional(),
    reuseWhen: z.string().optional(),
    watchouts: z.string().optional(),
    workflowSnapshot: reusableTaskSnapshotSchema.optional(),
    workflowContext: z.string().optional(),
});
