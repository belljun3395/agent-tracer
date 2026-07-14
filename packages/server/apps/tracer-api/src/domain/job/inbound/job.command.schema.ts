import { z } from "zod";
import { AI_AGENT_BACKEND, JOB_KIND, type JobKind } from "@monitor/kernel";
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

export type EnqueueBody = z.infer<typeof enqueueBodySchema>;
