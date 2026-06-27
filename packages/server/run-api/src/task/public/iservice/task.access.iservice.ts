import type { TaskSnapshot, TaskStatus, TaskUpsertInput } from "../dto/task.snapshot.dto.js";

export interface ITaskAccess {
    findById(id: string): Promise<TaskSnapshot | null>;
    findChildren(parentId: string): Promise<readonly TaskSnapshot[]>;
    upsert(input: TaskUpsertInput): Promise<TaskSnapshot>;
    updateStatus(id: string, status: TaskStatus, updatedAt: string): Promise<void>;
}
