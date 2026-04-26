import type { SessionCreatePortDto } from "./dto/session.create.port.dto.js";
import type { SessionRecordPortDto } from "./dto/session.record.port.dto.js";

export interface SessionWritePort {
    create(input: SessionCreatePortDto): Promise<SessionRecordPortDto>;
    updateStatus(
        id: string,
        status: SessionRecordPortDto["status"],
        endedAt: string,
        summary?: string,
    ): Promise<void>;
}
