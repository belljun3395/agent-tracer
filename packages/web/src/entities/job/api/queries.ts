import type { AiJobStepList, JobDto, JobListDto } from "@monitor/kernel";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { isActiveJobStatus, type JobKind, type JobStatus } from "~web/entities/job/model/job.js";
import {
  fetchJob,
  fetchJobHistory,
  fetchJobSteps,
  fetchLatestJob,
} from "~web/entities/job/api/api-jobs.js";
import type { TaskId } from "~web/shared/identity.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

// 종류별 최신 잡 상태를 폴링한다.
export function useJobStatus<T extends { readonly status: JobStatus }>(
  kind: JobKind,
  options?: { readonly taskId?: TaskId; readonly enabled?: boolean },
): UseQueryResult<{ job: T | null }> {
  const taskId = options?.taskId;
  return useQuery({
    queryKey: monitorQueryKeys.latestJob(kind, taskId),
    queryFn: () => fetchLatestJob<T>(kind, taskId ? { taskId } : undefined),
    enabled: options?.enabled ?? true,
    refetchInterval: (q) => (isActiveJobStatus(q.state.data?.job?.status) ? 1500 : false),
  });
}

const JOB_HISTORY_POLL_MS = 5_000;

export interface JobHistoryFilters {
  readonly kind?: JobKind;
  readonly status?: JobStatus;
  readonly limit?: number;
  readonly offset?: number;
}

// WS `sdk_job.updated`가 빠른 경로다.
export function useJobsHistoryQuery(filters: JobHistoryFilters = {}): UseQueryResult<JobListDto> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  return useQuery({
    queryKey: monitorQueryKeys.jobsHistory(
      filters.kind ?? "all",
      filters.status ?? "all",
      limit,
      offset,
    ),
    queryFn: () => fetchJobHistory({ ...filters, limit, offset }),
    refetchInterval: (query) =>
      (query.state.data?.items ?? []).some((job) => isActiveJobStatus(job.status))
        ? JOB_HISTORY_POLL_MS
        : false,
  });
}

export function useJobQuery(jobId: string | null): UseQueryResult<{ readonly job: JobDto }> {
  return useQuery({
    queryKey: monitorQueryKeys.job(jobId ?? "__disabled__"),
    queryFn: () => {
      if (jobId === null) throw new Error("useJobQuery called without a jobId");
      return fetchJob(jobId);
    },
    enabled: jobId !== null,
  });
}

export function useJobStepsQuery(jobId: string | null): UseQueryResult<AiJobStepList> {
  return useQuery({
    queryKey: monitorQueryKeys.jobSteps(jobId ?? "__disabled__"),
    queryFn: () => {
      if (jobId === null) throw new Error("useJobStepsQuery called without a jobId");
      return fetchJobSteps(jobId);
    },
    enabled: jobId !== null,
  });
}
