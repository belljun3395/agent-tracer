import type { TaskDeleteResultPortDto } from "./dto/task.delete.port.dto.js";
import type { TaskRecordPortDto } from "./dto/task.record.port.dto.js";
import type { TaskUpsertPortDto } from "./dto/task.upsert.port.dto.js";

export interface TaskWritePort {
    upsert(input: TaskUpsertPortDto): Promise<TaskRecordPortDto>;
    updateStatus(id: string, status: TaskRecordPortDto["status"], updatedAt: string): Promise<void>;
    updateTitle(id: string, title: string, slug: TaskRecordPortDto["slug"], updatedAt: string): Promise<void>;
    delete(id: string): Promise<TaskDeleteResultPortDto>;
    deleteFinished(): Promise<number>;
}
