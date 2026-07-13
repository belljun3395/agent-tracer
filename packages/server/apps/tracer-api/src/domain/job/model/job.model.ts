import type { AiJobEntity } from "@monitor/tracer-domain";
import type { JobDto } from "@monitor/kernel";

export type { JobDto };

export function mapJob(job: AiJobEntity): JobDto {
    return {
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
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        startedAt: job.startedAt !== null ? job.startedAt.toISOString() : null,
        completedAt: job.completedAt !== null ? job.completedAt.toISOString() : null,
    };
}
