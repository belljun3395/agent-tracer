import { Inject, Injectable } from "@nestjs/common";
import { EVENT_PERSISTENCE_PORT } from "../application/outbound/tokens.js";
import type {
    IEventPersistence,
    PersistedTimelineEvent,
    TimelineEventInsertRequest,
} from "../application/outbound/event.persistence.port.js";
import type { TimelineEventSnapshot } from "../public/dto/timeline.event.dto.js";

function toSnapshot(event: PersistedTimelineEvent): TimelineEventSnapshot {
    return event;
}

@Injectable()
export class TimelineEventService {
    constructor(
        @Inject(EVENT_PERSISTENCE_PORT) private readonly persistence: IEventPersistence,
    ) {}

    async findById(id: string): Promise<TimelineEventSnapshot | null> {
        const event = await this.persistence.findById(id);
        return event ? toSnapshot(event) : null;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEventSnapshot[]> {
        const events = await this.persistence.findByTaskId(taskId);
        return events.map(toSnapshot);
    }

    async insert(input: TimelineEventInsertRequest): Promise<TimelineEventSnapshot> {
        const event = await this.persistence.insert(input);
        return toSnapshot(event);
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEventSnapshot | null> {
        const event = await this.persistence.updateMetadata(eventId, metadata);
        return event ? toSnapshot(event) : null;
    }

    countAll(): Promise<number> {

        return Promise.resolve(0);
    }
}
