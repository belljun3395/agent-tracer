import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "@monitor/timeline-api/public/event/dto/timeline.event.dto.js";

export interface ITimelineEventProjection {
    project(event: TimelineEventSnapshot): TimelineEventProjection;
}
