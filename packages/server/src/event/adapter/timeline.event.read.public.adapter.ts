import { Injectable } from "@nestjs/common";
import { TimelineEventService } from "../service/timeline.event.service.js";
import type { ITimelineEventRead } from "../public/iservice/timeline.event.read.iservice.js";
import type { TimelineEventSnapshot } from "../public/dto/timeline.event.dto.js";

/** Public adapter — implements ITimelineEventRead by delegating to internal service. */
@Injectable()
export class TimelineEventReadPublicAdapter implements ITimelineEventRead {
    constructor(private readonly service: TimelineEventService) {}

    findById(id: string): Promise<TimelineEventSnapshot | null> {
        return this.service.findById(id);
    }

    findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]> {
        return this.service.findByTaskId(taskId);
    }

    countAll(): Promise<number> {
        return this.service.countAll();
    }
}
