import type { TaskRecordPortDto } from "./dto/task.record.port.dto.js";

export interface TaskReadPort {
    findById(id: string): Promise<TaskRecordPortDto | null>;
    findAll(): Promise<readonly TaskRecordPortDto[]>;
    findChildren(parentId: string): Promise<readonly TaskRecordPortDto[]>;
}
