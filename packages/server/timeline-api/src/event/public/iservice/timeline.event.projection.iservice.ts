import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "../dto/timeline.event.dto.js";

export interface ITimelineEventProjection {
    project(event: TimelineEventSnapshot): TimelineEventProjection;
}
