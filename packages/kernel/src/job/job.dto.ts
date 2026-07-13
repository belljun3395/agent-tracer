import type { JobExecutor, JobKind, JobStatus } from "./job.const.js";

export interface JobDto {
    readonly id: string;
    readonly userId: string;
    readonly kind: JobKind;
    readonly executor: JobExecutor;
    readonly status: JobStatus;
    readonly attempts: number;
    readonly taskId: string | null;
    readonly input: Record<string, unknown>;
    readonly result: Record<string, unknown>;
    readonly usage: Record<string, unknown>;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
}

export interface JobListDto {
    readonly items: readonly JobDto[];
    readonly total: number;
}
