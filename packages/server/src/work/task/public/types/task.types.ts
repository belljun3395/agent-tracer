/**
 * Public task-domain types — re-exports for cross-module consumers
 * (event search, session, notifications dto, mcp tools).
 */
export type {
    MonitoringTaskKind,
    TaskStatus,
    TaskCompletionReason,
} from "~work/task/common/task.status.type.js";

export type { MonitoringTask, MonitoringTaskInput } from "~work/task/domain/task.model.js";
