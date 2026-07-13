import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { AiAgentBackend, JobKind } from "~web/entities/job/model/job.js";
import {
  cancelJob,
  enqueueJob,
  submitJobFeedback,
  type SubmitJobFeedbackBody,
} from "~web/entities/job/api/api-jobs.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useEnqueueJob<TInput>(kind: JobKind) {
  const queryClient = useQueryClient();
  const idempotencyKeysRef = useRef(new Map<string, { key: string; inFlight: number }>());
  return useMutation({
    mutationFn: async (input: TInput) => {
      const { jobInput, agentBackend } = splitAgentBackend(input);
      const signature = createJobSubmissionSignature(kind, { input: jobInput, agentBackend });
      const idempotencyKey = acquireIdempotencyKey(idempotencyKeysRef.current, kind, signature);
      try {
        return await enqueueJob(kind, jobInput, {
          idempotencyKey,
          ...(agentBackend !== undefined ? { agentBackend } : {}),
        });
      } finally {
        releaseIdempotencyKey(idempotencyKeysRef.current, signature, idempotencyKey);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.latestJobPrefix(kind),
      });
    },
  });
}

export function useSubmitJobFeedbackMutation() {
  return useMutation({
    mutationFn: ({ jobId, ...body }: { readonly jobId: string } & SubmitJobFeedbackBody) =>
      submitJobFeedback(jobId, body),
  });
}

export function useCancelJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelJob(jobId),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.jobsHistoryPrefix() });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.job(job.id) });
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.latestJobPrefix(job.kind),
      });
    },
  });
}

function splitAgentBackend<TInput>(input: TInput): {
  readonly jobInput: TInput;
  readonly agentBackend?: AiAgentBackend;
} {
  if (typeof input !== "object" || input === null || !("agentBackend" in input)) {
    return { jobInput: input };
  }
  const { agentBackend, ...rest } = input as TInput & { readonly agentBackend?: AiAgentBackend };
  return {
    jobInput: rest as TInput,
    ...(agentBackend !== undefined ? { agentBackend } : {}),
  };
}

function createJobSubmissionSignature(kind: JobKind, input: unknown): string {
  return `${kind}:${stableJson(input)}`;
}

function acquireIdempotencyKey(
  entries: Map<string, { key: string; inFlight: number }>,
  kind: JobKind,
  signature: string,
): string {
  const existing = entries.get(signature);
  if (existing !== undefined) {
    existing.inFlight += 1;
    return existing.key;
  }
  const key = `${kind}:${createRandomId()}`;
  entries.set(signature, { key, inFlight: 1 });
  return key;
}

function releaseIdempotencyKey(
  entries: Map<string, { key: string; inFlight: number }>,
  signature: string,
  key: string,
): void {
  const existing = entries.get(signature);
  if (existing === undefined || existing.key !== key) return;
  existing.inFlight -= 1;
  if (existing.inFlight <= 0) entries.delete(signature);
}

function createRandomId(): string {
  return globalThis.crypto.randomUUID();
}

function stableJson(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(toStableJsonValue(value));
}

function toStableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStableJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, toStableJsonValue(child)]),
    );
  }
  return value;
}
