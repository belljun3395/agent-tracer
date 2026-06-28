import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";

export interface ITimelineEventAccess {
    findById(id: string): Promise<TimelineEvent | null>;
}
