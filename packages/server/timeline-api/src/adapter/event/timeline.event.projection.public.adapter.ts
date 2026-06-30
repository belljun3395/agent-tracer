import { Injectable } from "@nestjs/common";
import { TimelineEventProjector } from "@monitor/timeline-api/domain/event/timeline.event.projection.policy.js";
import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "@monitor/timeline-api/public/event/dto/timeline.event.dto.js";
import type { ITimelineEventProjection } from "@monitor/timeline-api/public/event/iservice/timeline.event.projection.iservice.js";

@Injectable()
export class TimelineEventProjectionPublicAdapter implements ITimelineEventProjection {
    project(event: TimelineEventSnapshot): TimelineEventProjection {
        return new TimelineEventProjector(event).project();
    }
}
