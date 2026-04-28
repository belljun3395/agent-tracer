export const MONITORING_TASK_KINDS = ["primary", "background"] as const;

export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;

export const TASK_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

export const ASYNC_TASK_STATUSES = ["pending", "running", "completed", "error", "cancelled", "interrupt"] as const;
