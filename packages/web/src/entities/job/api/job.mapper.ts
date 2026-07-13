import type { JobDto } from "@monitor/kernel";

export function toJobStatus(job: JobDto): Record<string, unknown> {
  return {
    ...job.result,
    id: job.id,
    userId: job.userId,
    kind: job.kind,
    executor: job.executor,
    status: job.status,
    attempts: job.attempts,
    taskId: job.taskId,
    input: job.input,
    result: job.result,
    usage: job.usage,
    error: job.error,
    modelUsed: readString(job.usage, "model") ?? readString(job.usage, "modelUsed"),
    durationMs: readNumber(job.usage, "durationMs"),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
