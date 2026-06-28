import type { MonitoringTask } from "../types/task.types.js";
import type { TaskStatus, TaskUpsertInput } from "../dto/task.snapshot.dto.js";

export interface ITaskAccess {
    findById(id: string): Promise<MonitoringTask | null>;
    findChildren(parentId: string): Promise<readonly MonitoringTask[]>;
    upsert(input: TaskUpsertInput): Promise<MonitoringTask>;
    updateStatus(id: string, status: TaskStatus, updatedAt: string): Promise<void>;
}
