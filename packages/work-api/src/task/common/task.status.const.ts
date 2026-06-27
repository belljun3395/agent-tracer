// Task status vocabulary now lives in @monitor/shared — neutral cross-context
// vocabulary consumed by run/rules/insight + notification contracts. Re-exported
// here so work-api internals keep importing from their own common/ barrel.
export {
    MONITORING_TASK_KINDS,
    TASK_ORIGINS,
    TASK_STATUSES,
    TASK_COMPLETION_REASONS,
    ASYNC_TASK_STATUSES,
    SERVER_SDK_TASK_ORIGIN,
    RUNNING_TASK_STATUS,
} from "@monitor/shared/task/task.status.const.js";
export type {
    MonitoringTaskKind,
    TaskOrigin,
    TaskStatus,
    TaskCompletionReason,
} from "@monitor/shared/task/task.status.const.js";
