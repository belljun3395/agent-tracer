import type { TimelineEventSnapshot } from "../dto/timeline.event.dto.js";

/**
 * Public iservice — read access to timeline events.
 * Consumed by task module (for openinference export, timeline view, etc).
 */
export interface ITimelineEventRead {
    findById(id: string): Promise<TimelineEventSnapshot | null>;
    findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]>;
    countAll(): Promise<number>;
}
