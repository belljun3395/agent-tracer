import type { JobKind, JobStatus } from "@monitor/kernel";

export const JOB_STATUS_NOTIFIER = Symbol("JobStatusNotifier");

export interface JobStatusChange {
    readonly jobId: string;
    readonly kind: JobKind;
    readonly status: JobStatus;
    readonly taskId?: string | undefined;
}

export interface JobStatusNotifier {
    notify(userId: string, change: JobStatusChange): void;
}
