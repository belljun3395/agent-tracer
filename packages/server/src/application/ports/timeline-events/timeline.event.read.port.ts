import type { TimelineEventRecordPortDto } from "./dto/timeline.event.record.port.dto.js";

export interface TimelineEventReadPort {
    findById(id: string): Promise<TimelineEventRecordPortDto | null>;
    findByTaskId(taskId: string): Promise<readonly TimelineEventRecordPortDto[]>;
}
