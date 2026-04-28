import type {
    MONITORING_TASK_KINDS,
    TASK_STATUSES,
    TASK_COMPLETION_REASONS,
} from "./task.status.const.js";

export type MonitoringTaskKind = (typeof MONITORING_TASK_KINDS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];
