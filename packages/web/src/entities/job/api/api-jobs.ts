import type { AiAgentBackend, JobKind, JobStatus } from "~web/entities/job/model/job.js";
import type { TaskId } from "~web/shared/identity.js";
import type { AiJobStepList, JobDto, JobListDto } from "@monitor/kernel";
import { getJson, postJson } from "~web/shared/api/client/json-methods.js";
import { toJobStatus } from "~web/entities/job/api/job.mapper.js";

// ─── Jobs (통합 비동기 잡) ─────────────────────────────────────────────────

export interface JobEnqueueResponse {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly createdAt: string;
}

export interface EnqueueJobOptions {
  readonly idempotencyKey?: string;
  readonly agentBackend?: AiAgentBackend;
}

// 잡을 큐에 넣는다.
export function enqueueJob<TInput>(
  kind: JobKind,
  input: TInput,
  options: EnqueueJobOptions = {},
): Promise<JobEnqueueResponse> {
  return postJson<JobEnqueueResponse>(`/api/v1/jobs`, {
    kind,
    input,
    ...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options.agentBackend !== undefined ? { agentBackend: options.agentBackend } : {}),
  });
}

export function fetchJob(jobId: string): Promise<{ readonly job: JobDto }> {
  return getJson<{ readonly job: JobDto }>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
}

export function fetchJobSteps(jobId: string): Promise<AiJobStepList> {
  return getJson<AiJobStepList>(`/api/v1/jobs/${encodeURIComponent(jobId)}/steps`);
}

// 종류별 최신 잡 상태.
export async function fetchLatestJob<T>(
  kind: JobKind,
  options?: { readonly taskId?: TaskId },
): Promise<{ job: T | null }> {
  const params = new URLSearchParams({ kind });
  if (options?.taskId) params.set("taskId", options.taskId);
  const res = await getJson<{ readonly job: JobDto | null }>(
    `/api/v1/jobs/latest?${params.toString()}`,
  );
  return { job: res.job !== null ? (toJobStatus(res.job) as T) : null };
}

export interface FetchJobHistoryOptions {
  readonly kind?: JobKind;
  readonly status?: JobStatus;
  readonly limit?: number;
  readonly offset?: number;
}

// 잡 관제 화면은 원본 잡 행(input·result·usage 포함)을 그대로 다룬다.
export async function fetchJobHistory(
  options: FetchJobHistoryOptions = {},
): Promise<JobListDto> {
  const params = new URLSearchParams();
  if (options.kind) params.set("kind", options.kind);
  if (options.status) params.set("status", options.status);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  const query = params.toString();
  return getJson<JobListDto>(`/api/v1/jobs/history${query ? `?${query}` : ""}`);
}

export async function cancelJob(jobId: string): Promise<JobDto> {
  const res = await postJson<{ readonly job: JobDto }>(`/api/v1/jobs/${jobId}/cancel`, {});
  return res.job;
}
