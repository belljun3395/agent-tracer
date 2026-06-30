import { Injectable } from "@nestjs/common";
import { TimelineEventProjector } from "../domain/timeline.event.projection.policy.js";
import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "../public/dto/timeline.event.dto.js";
import type { ITimelineEventProjection } from "../public/iservice/timeline.event.projection.iservice.js";

@Injectable()
export class TimelineEventProjectionPublicAdapter implements ITimelineEventProjection {
    project(event: TimelineEventSnapshot): TimelineEventProjection {
        return new TimelineEventProjector(event).project();
    }
}
