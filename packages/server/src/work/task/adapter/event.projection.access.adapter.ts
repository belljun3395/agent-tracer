import { Inject, Injectable } from "@nestjs/common";
import type { ITimelineEventProjection } from "~activity/event/public/iservice/timeline.event.projection.iservice.js";
import { TIMELINE_EVENT_PROJECTION } from "~activity/event/public/tokens.js";
import type {
    IEventProjectionAccess,
    ProjectableTimelineEvent,
    ProjectedTimelineEvent,
} from "../application/outbound/event.projection.access.port.js";

/**
 * Outbound adapter — bridges event module's public ITimelineEventProjection
 * to the task-local IEventProjectionAccess port.
 */
@Injectable()
export class EventProjectionAccessAdapter implements IEventProjectionAccess {
    constructor(
        @Inject(TIMELINE_EVENT_PROJECTION) private readonly inner: ITimelineEventProjection,
    ) {}

    project(event: ProjectableTimelineEvent): ProjectedTimelineEvent {
        return this.inner.project(event as never) as unknown as ProjectedTimelineEvent;
    }
}
