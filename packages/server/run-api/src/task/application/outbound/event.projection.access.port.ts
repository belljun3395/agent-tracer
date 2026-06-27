import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";

export type ProjectableTimelineEvent = TimelineEventSnapshot;
export type ProjectedTimelineEvent = TimelineEventProjection;

export interface IEventProjectionAccess {
    project(event: ProjectableTimelineEvent): ProjectedTimelineEvent;
}
