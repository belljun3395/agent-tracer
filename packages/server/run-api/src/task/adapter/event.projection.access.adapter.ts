import { Inject, Injectable } from "@nestjs/common";
import type { ITimelineEventProjection } from "@monitor/timeline-api/event/public/iservice/timeline.event.projection.iservice.js";
import { TIMELINE_EVENT_PROJECTION } from "@monitor/timeline-api/event/public/tokens.js";
import type {
    IEventProjectionAccess,
    ProjectableTimelineEvent,
    ProjectedTimelineEvent,
} from "../application/outbound/event.projection.access.port.js";

@Injectable()
export class EventProjectionAccessAdapter implements IEventProjectionAccess {
    constructor(
        @Inject(TIMELINE_EVENT_PROJECTION) private readonly inner: ITimelineEventProjection,
    ) {}

    project(event: ProjectableTimelineEvent): ProjectedTimelineEvent {
        return this.inner.project(event);
    }
}
