import type { TaskStatus } from "~domain/monitoring/common/type/task.status.type.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";

export type TaskRecordPortDto = MonitoringTask;
export type TaskStatusPortDto = TaskStatus;
