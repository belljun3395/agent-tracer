export const JOB_STATUS = {
    pending: "pending",
    processing: "processing",
    completed: "completed",
    failed: "failed",
} as const;

export const JOB_STATUSES = [
    JOB_STATUS.pending,
    JOB_STATUS.processing,
    JOB_STATUS.completed,
    JOB_STATUS.failed,
] as const;

// 아직 끝나지 않아 워커가 집어갈 수 있는 상태.
export const ACTIVE_JOB_STATUSES = [
    JOB_STATUS.pending,
    JOB_STATUS.processing,
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
