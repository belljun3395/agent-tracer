import { Inject, Injectable } from "@nestjs/common";
import type { ITimelineEventRead } from "~activity/event/public/iservice/timeline.event.read.iservice.js";
import type { ITimelineEventWrite } from "~activity/event/public/iservice/timeline.event.write.iservice.js";
import { TIMELINE_EVENT_READ, TIMELINE_EVENT_WRITE } from "~activity/event/public/tokens.js";
import type {
    ITimelineEventAccess,
    TimelineEventInsertInput,
    TimelineEventRecord,
} from "../application/outbound/timeline.event.access.port.js";

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

    async insert(input: TimelineEventInsertInput): Promise<TimelineEventRecord> {
        const record = await this.write.insert(input as never);
        return record as unknown as TimelineEventRecord;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEventRecord[]> {
        const records = await this.read.findByTaskId(taskId);
        return records as unknown as readonly TimelineEventRecord[];
    }

    async findById(id: string): Promise<TimelineEventRecord | null> {
        const record = await this.read.findById(id);
        return (record as unknown as TimelineEventRecord | null) ?? null;
    }

    countAll(): Promise<number> {
        return this.read.countAll();
    }
}
