import type { JobDto } from "@monitor/kernel";
import {
  JOB_KIND,
  JOB_STATUS,
  JOB_STATUSES,
  type JobKind,
  type JobStatus,
} from "~web/entities/job/model/job.js";
import type { StatusKind } from "~web/shared/ui/lib/status-kind.js";

export const JOB_KIND_LABEL: Readonly<Record<JobKind, string>> = {
  [JOB_KIND.titleSuggestion]: "Title suggestion",
  [JOB_KIND.recipeScan]: "Recipe scan",
  [JOB_KIND.taskCleanup]: "Task cleanup",
  [JOB_KIND.ruleGeneration]: "Rule generation",
};

export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  [JOB_STATUS.pending]: "Pending",
  [JOB_STATUS.running]: "Running",
  [JOB_STATUS.completed]: "Completed",
  [JOB_STATUS.failed]: "Failed",
  [JOB_STATUS.canceled]: "Canceled",
};

const STATUS_DOT: Readonly<Record<JobStatus, StatusKind>> = {
  [JOB_STATUS.pending]: "waiting",
  [JOB_STATUS.running]: "running",
  [JOB_STATUS.completed]: "done",
  [JOB_STATUS.failed]: "failed",
  [JOB_STATUS.canceled]: "canceled",
};

export function statusDotKind(status: JobStatus): StatusKind {
  return STATUS_DOT[status];
}

export function isJobKind(value: string | null): value is JobKind {
  return value !== null && Object.values(JOB_KIND).includes(value as JobKind);
}

export function isJobStatus(value: string | null): value is JobStatus {
  return value !== null && JOB_STATUSES.includes(value as JobStatus);
}

// 실행 중이면 지금까지, 끝났으면 종료 시각까지의 경과 시간(ms). 시작 전이면 null.
export function elapsedMs(job: JobDto, now: number): number | null {
  if (job.startedAt === null) return null;
  const started = Date.parse(job.startedAt);
  const ended = job.completedAt !== null ? Date.parse(job.completedAt) : now;
  return Math.max(0, ended - started);
}

// 잡 종류별로 결과 jsonb에서 한 줄 요약을 뽑는다.
export function summarizeResult(job: JobDto): string | null {
  if (job.status !== JOB_STATUS.completed) return null;
  const result = job.result;
  switch (job.kind) {
    case JOB_KIND.titleSuggestion: {
      const suggestions = result["suggestions"];
      if (!Array.isArray(suggestions)) return null;
      return suggestions.length === 0
        ? "No suggestions"
        : countLabel(suggestions.length, "suggestion");
    }
    case JOB_KIND.recipeScan: {
      const created = numberOf(result["candidatesCreated"]);
      const revised = numberOf(result["recipesRevised"]);
      if (created === null) return null;
      const candidates = countLabel(created, "candidate");
      return revised ? `${candidates} · ${revised} revised` : candidates;
    }
    case JOB_KIND.taskCleanup: {
      const created = numberOf(result["suggestionsCreated"]);
      const scanned = numberOf(result["tasksScanned"]);
      if (created === null) return null;
      return `${countLabel(created, "suggestion")} / ${countLabel(scanned ?? 0, "task")}`;
    }
    case JOB_KIND.ruleGeneration: {
      const created = numberOf(result["rulesCreated"]);
      return created === null ? null : countLabel(created, "rule");
    }
  }
}

export interface JobUsageSummary {
  readonly modelUsed: string | null;
  readonly durationMs: number | null;
  readonly costUsd: number | null;
  readonly numTurns: number | null;
}

export function readUsage(job: JobDto): JobUsageSummary {
  const usage = job.usage;
  return {
    modelUsed: stringOf(usage["modelUsed"]),
    durationMs: numberOf(usage["durationMs"]),
    costUsd: numberOf(usage["costUsd"]),
    numTurns: numberOf(usage["numTurns"]),
  };
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
