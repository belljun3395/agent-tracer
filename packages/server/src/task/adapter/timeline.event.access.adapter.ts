import { Inject, Injectable } from "@nestjs/common";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import { EVENT_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    ITimelineEventAccess,
    TimelineEventInsertInput,
    TimelineEventRecord,
} from "../application/outbound/timeline.event.access.port.js";

/**
 * Outbound adapter — bridges legacy IEventRepository to the task-local
 * ITimelineEventAccess port. Will be retargeted at the future event module's
 * public iservice once it exists.
 */
@Injectable()
export class TimelineEventAccessAdapter implements ITimelineEventAccess {
    constructor(
        @Inject(EVENT_REPOSITORY_TOKEN) private readonly inner: IEventRepository,
    ) {}

    async insert(input: TimelineEventInsertInput): Promise<TimelineEventRecord> {
        const record = await this.inner.insert(input as never);
        return record as unknown as TimelineEventRecord;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEventRecord[]> {
        const records = await this.inner.findByTaskId(taskId);
        return records as unknown as readonly TimelineEventRecord[];
    }

    async findById(id: string): Promise<TimelineEventRecord | null> {
        const record = await this.inner.findById(id);
        return (record as unknown as TimelineEventRecord | null) ?? null;
    }

    countAll(): Promise<number> {
        // Legacy IEventRepository doesn't expose count directly; the count is
        // reached via task overview port. For now defer to caller (TaskQueryService
        // will wire this through TaskRepository's overview helper).
        return Promise.resolve(0);
    }
}
