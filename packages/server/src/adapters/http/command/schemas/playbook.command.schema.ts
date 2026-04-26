import { z } from "zod";
import { PLAYBOOK_STATUSES } from "~application/workflow/index.js";

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
