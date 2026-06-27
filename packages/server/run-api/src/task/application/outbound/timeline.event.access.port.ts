import type { TimelineEventWriteInput } from "@monitor/timeline-api/event/public/iservice/timeline.event.write.iservice.js";
import type { TimelineEventSnapshot } from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";

export interface ITimelineEventAccess {
    insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot>;
    findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]>;
    findById(id: string): Promise<TimelineEventSnapshot | null>;
    countAll(): Promise<number>;
}
