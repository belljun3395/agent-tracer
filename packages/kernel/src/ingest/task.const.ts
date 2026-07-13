export const MONITORING_TASK_KINDS = ["primary", "background"] as const;
export const MONITORING_TASK_KIND = {
    primary: "primary",
    background: "background",
} as const satisfies Record<string, (typeof MONITORING_TASK_KINDS)[number]>;

export const TASK_ORIGINS = ["user", "server-sdk"] as const;

export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;

export const TASK_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

export type MonitoringTaskKind = (typeof MONITORING_TASK_KINDS)[number];
export type TaskOrigin = (typeof TASK_ORIGINS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];

export const USER_TASK_ORIGIN: TaskOrigin = "user";
export const SERVER_SDK_TASK_ORIGIN: TaskOrigin = "server-sdk";

export const RUNNING_TASK_STATUS = "running" as const satisfies TaskStatus;
export const WAITING_TASK_STATUS = "waiting" as const satisfies TaskStatus;
export const COMPLETED_TASK_STATUS = "completed" as const satisfies TaskStatus;
export const ERRORED_TASK_STATUS = "errored" as const satisfies TaskStatus;

export const TASK_COMPLETION_REASON = {
    idle: "idle",
    assistantTurnComplete: "assistant_turn_complete",
    explicitExit: "explicit_exit",
    runtimeTerminated: "runtime_terminated",
} as const satisfies Record<string, TaskCompletionReason>;
