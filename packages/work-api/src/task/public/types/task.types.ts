/**
 * Public task-domain types — re-exports for cross-module consumers
 * (event search, session, notifications dto, mcp tools).
 */
export type {
    MonitoringTaskKind,
    TaskStatus,
    TaskCompletionReason,
} from "@monitor/work-api/task/common/task.status.const.js";

export type { MonitoringTask, MonitoringTaskInput } from "@monitor/work-api/task/domain/task.model.js";
