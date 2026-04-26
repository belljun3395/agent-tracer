export const TASK_KINDS = ["primary", "background"] as const;
export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;
export const COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

export type MonitoringTaskKind = (typeof TASK_KINDS)[number];
export type TaskCompletionReason = (typeof COMPLETION_REASONS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
