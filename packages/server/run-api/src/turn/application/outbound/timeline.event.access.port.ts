import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";

export type TimelineEventAccessRecord = TimelineEvent;

export interface ITimelineEventAccess {
    findByTaskId(taskId: string): Promise<readonly TimelineEventAccessRecord[]>;
}
