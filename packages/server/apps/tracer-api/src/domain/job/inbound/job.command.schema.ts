import { z } from "zod";
import { AI_AGENT_BACKEND, JOB_FEEDBACK_KIND, JOB_KIND, type JobKind } from "@monitor/kernel";
import { JOB_INPUT_SCHEMA_BY_KIND } from "@monitor/kernel/job/job.input.schema.js";

const agentBackendSchema = z.enum([AI_AGENT_BACKEND.python, AI_AGENT_BACKEND.claudeSdk]);

function enqueueBodyFor<K extends JobKind>(kind: K) {
    return z.object({
        kind: z.literal(kind),
        input: JOB_INPUT_SCHEMA_BY_KIND[kind].optional(),
        agentBackend: agentBackendSchema.optional(),
        idempotencyKey: z.string().trim().min(1).max(200).optional(),
    });
}

export const enqueueBodySchema = z.discriminatedUnion("kind", [
    enqueueBodyFor(JOB_KIND.titleSuggestion),
    enqueueBodyFor(JOB_KIND.recipeScan),
    enqueueBodyFor(JOB_KIND.taskCleanup),
    enqueueBodyFor(JOB_KIND.ruleGeneration),
]);

const editedContentSchema = z.record(z.unknown()).refine((value) => Object.keys(value).length > 0, {
    message: "editedContent must not be empty",
});
const targetIdSchema = z.string().trim().min(1).max(64).optional();

export const feedbackBodySchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal(JOB_FEEDBACK_KIND.accept), targetId: targetIdSchema }),
    z.object({ kind: z.literal(JOB_FEEDBACK_KIND.reject), targetId: targetIdSchema }),
    z.object({ kind: z.literal(JOB_FEEDBACK_KIND.edit), editedContent: editedContentSchema, targetId: targetIdSchema }),
    z.object({ kind: z.literal(JOB_FEEDBACK_KIND.rating), ratingValue: z.number().int().min(1).max(5), targetId: targetIdSchema }),
]);

export type EnqueueBody = z.infer<typeof enqueueBodySchema>;
export type FeedbackBody = z.infer<typeof feedbackBodySchema>;
