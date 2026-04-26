import type { TimelineEventInsertPortDto } from "./dto/timeline.event.insert.port.dto.js";
import type { TimelineEventRecordPortDto } from "./dto/timeline.event.record.port.dto.js";

export interface TimelineEventWritePort {
    insert(input: TimelineEventInsertPortDto): Promise<TimelineEventRecordPortDto>;
    updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEventRecordPortDto | null>;
}
