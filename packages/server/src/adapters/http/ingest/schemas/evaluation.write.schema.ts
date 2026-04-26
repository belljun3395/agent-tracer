import { z } from "zod";
import { WORKFLOW_RATINGS } from "~domain/index.js";

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
