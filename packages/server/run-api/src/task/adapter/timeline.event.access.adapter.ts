import { Inject, Injectable } from "@nestjs/common";
import type { ITimelineEventRead } from "@monitor/timeline-api/event/public/iservice/timeline.event.read.iservice.js";
import type { ITimelineEventWrite, TimelineEventWriteInput } from "@monitor/timeline-api/event/public/iservice/timeline.event.write.iservice.js";
import type { TimelineEventSnapshot } from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";
import { TIMELINE_EVENT_READ, TIMELINE_EVENT_WRITE } from "@monitor/timeline-api/event/public/tokens.js";
import type { ITimelineEventAccess } from "../application/outbound/timeline.event.access.port.js";

/**
 * Outbound adapter — bridges event module's public ITimelineEventRead +
 * ITimelineEventWrite to the task-local ITimelineEventAccess port. This is
 * the only path task module takes for timeline event reads/writes; it does
 * NOT touch the legacy IEventRepository, so all writes flow through the
 * event module's TypeORM storage.
 */
@Injectable()
export class TimelineEventAccessAdapter implements ITimelineEventAccess {
    constructor(
        @Inject(TIMELINE_EVENT_READ) private readonly read: ITimelineEventRead,
        @Inject(TIMELINE_EVENT_WRITE) private readonly write: ITimelineEventWrite,
    ) {}

    insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot> {
        return this.write.insert(input);
    }

    findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]> {
        return this.read.findByTaskId(taskId);
    }

    findById(id: string): Promise<TimelineEventSnapshot | null> {
        return this.read.findById(id);
    }

    countAll(): Promise<number> {
        return this.read.countAll();
    }
}
