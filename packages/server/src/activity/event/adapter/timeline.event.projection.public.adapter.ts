import { Injectable } from "@nestjs/common";
import type { TimelineEvent } from "~activity/event/domain/model/timeline.event.model.js";
import { TimelineEventProjector } from "../domain/timeline.event.projection.model.js";
import type {
    TimelineEventProjection,
    TimelineEventSnapshot,
} from "../public/dto/timeline.event.dto.js";
import type { ITimelineEventProjection } from "../public/iservice/timeline.event.projection.iservice.js";

/**
 * Public adapter — implements ITimelineEventProjection by running the
 * internal TimelineEventProjector domain model. Other modules that need to
 * publish event.logged / event.updated payloads consume this iservice.
 */
@Injectable()
export class TimelineEventProjectionPublicAdapter implements ITimelineEventProjection {
    project(event: TimelineEventSnapshot): TimelineEventProjection {
        return new TimelineEventProjector(event as unknown as TimelineEvent).project();
    }
}
