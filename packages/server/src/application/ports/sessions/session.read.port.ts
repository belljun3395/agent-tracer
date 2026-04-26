import type { SessionRecordPortDto } from "./dto/session.record.port.dto.js";

export interface SessionReadPort {
    findById(id: string): Promise<SessionRecordPortDto | null>;
    findByTaskId(taskId: string): Promise<readonly SessionRecordPortDto[]>;
    findActiveByTaskId(taskId: string): Promise<SessionRecordPortDto | null>;
    countRunningByTaskId(taskId: string): Promise<number>;
}
