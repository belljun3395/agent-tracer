import { Inject, Injectable } from "@nestjs/common";
import { EVENT_PERSISTENCE_PORT } from "../application/outbound/tokens.js";
import type { IEventPersistence } from "../application/outbound/event.persistence.port.js";
import type {
    ITimelineEventWrite,
    TimelineEventWriteInput,
} from "../public/iservice/timeline.event.write.iservice.js";
import type { TimelineEventSnapshot } from "../public/dto/timeline.event.dto.js";

/**
 * Public adapter — implements ITimelineEventWrite by delegating to the
 * EVENT_PERSISTENCE_PORT (TimelineEventStorageService + FTS refresh +
 * event-store append). All cross-module timeline event writes flow through
 * this adapter so the side effects stay consistent with module-internal writes.
 */
@Injectable()
export class TimelineEventWritePublicAdapter implements ITimelineEventWrite {
    constructor(
        @Inject(EVENT_PERSISTENCE_PORT) private readonly persistence: IEventPersistence,
    ) {}

    async insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot> {
        const event = await this.persistence.insert(input as never);
        return event as unknown as TimelineEventSnapshot;
    }
}
