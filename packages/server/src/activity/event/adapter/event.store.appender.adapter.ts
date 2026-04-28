import { Injectable } from "@nestjs/common";
import { mapTimelineInsertToDomainEvent } from "../repository/event-store/timeline.event.mapper.js";
import { EventStoreService } from "../repository/event-store/event.store.service.js";
import type {
    DomainEventAppendInput,
    IEventStoreAppender,
} from "../application/outbound/event.store.appender.port.js";

/**
 * Outbound adapter — translates a freshly inserted timeline event into a
 * domain-event sourcing entry. Backed by EventStoreService (TypeORM).
 */
@Injectable()
export class EventStoreAppenderAdapter implements IEventStoreAppender {
    constructor(private readonly store: EventStoreService) {}

    async append(input: DomainEventAppendInput): Promise<void> {
        const draft = mapTimelineInsertToDomainEvent(input as never);
        if (draft) await this.store.append(draft);
    }
}
