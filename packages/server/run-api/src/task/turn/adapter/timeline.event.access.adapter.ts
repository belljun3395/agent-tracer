import { Inject, Injectable } from "@nestjs/common";
import type { ITimelineEventRead } from "@monitor/timeline-api/event/public/iservice/timeline.event.read.iservice.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/event/public/tokens.js";
import type {
    ITimelineEventAccess,
    TimelineEventAccessRecord,
} from "../application/outbound/timeline.event.access.port.js";

@Injectable()
export class TimelineEventAccessAdapter implements ITimelineEventAccess {
    constructor(
        @Inject(TIMELINE_EVENT_READ) private readonly inner: ITimelineEventRead,
    ) {}

    async findByTaskId(taskId: string): Promise<readonly TimelineEventAccessRecord[]> {
        return this.inner.findByTaskId(taskId);
    }
}
