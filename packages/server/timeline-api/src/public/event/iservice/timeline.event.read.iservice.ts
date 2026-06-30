import type { TimelineEventSnapshot } from "@monitor/timeline-api/public/event/dto/timeline.event.dto.js";

export interface ITimelineEventRead {
    findById(id: string): Promise<TimelineEventSnapshot | null>;
    findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]>;
    countAll(): Promise<number>;
}
