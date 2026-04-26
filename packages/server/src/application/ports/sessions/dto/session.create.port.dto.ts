import type { SessionRecordPortDto } from "./session.record.port.dto.js";

export interface SessionCreatePortDto {
    readonly id: string;
    readonly taskId: string;
    readonly status: SessionRecordPortDto["status"];
    readonly startedAt: string;
    readonly summary?: string;
}
