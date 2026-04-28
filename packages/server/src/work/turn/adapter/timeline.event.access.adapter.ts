import { Inject, Injectable } from "@nestjs/common";
import type { ITimelineEventRead } from "~activity/event/public/iservice/timeline.event.read.iservice.js";
import { TIMELINE_EVENT_READ } from "~activity/event/public/tokens.js";
import type {
    ITimelineEventAccess,
    TimelineEventAccessRecord,
} from "../application/outbound/timeline.event.access.port.js";

/**
 * Outbound adapter — bridges event module's public ITimelineEventRead to the
 * turn-partition-local timeline event port.
 */
@Injectable()
export class TimelineEventAccessAdapter implements ITimelineEventAccess {
    constructor(
        @Inject(TIMELINE_EVENT_READ) private readonly inner: ITimelineEventRead,
    ) {}

    async findByTaskId(taskId: string): Promise<readonly TimelineEventAccessRecord[]> {
        const events = await this.inner.findByTaskId(taskId);
        return events as unknown as readonly TimelineEventAccessRecord[];
    }
}
