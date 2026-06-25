export const MONITORING_TASK_KINDS = ["primary", "background"] as const;

export const TASK_ORIGINS = ["user", "server-sdk"] as const;

export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;

export const TASK_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

export const ASYNC_TASK_STATUSES = ["pending", "running", "completed", "error", "cancelled", "interrupt"] as const;

export type MonitoringTaskKind = (typeof MONITORING_TASK_KINDS)[number];
export type TaskOrigin = (typeof TASK_ORIGINS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];
