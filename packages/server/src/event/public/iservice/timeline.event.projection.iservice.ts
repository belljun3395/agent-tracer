import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "../dto/timeline.event.dto.js";

/**
 * Public iservice — projects a timeline event into the wire format used
 * by WS / SSE notifications. Other modules (session, task) call this when
 * publishing event.logged / event.updated notifications.
 */
export interface ITimelineEventProjection {
    project(event: TimelineEventSnapshot): TimelineEventProjection;
}
