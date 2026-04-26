import type { AnyDomainEventDraft, DomainEvent } from "~domain/events/model/domain.events.model.js";
import type { EventId, TimeRange } from "~domain/events/model/event.model.js";

export interface DomainEventStorePort {
    append(event: AnyDomainEventDraft): Promise<DomainEvent>;
    readAggregate(aggregateId: string, from?: EventId): AsyncIterable<DomainEvent>;
    readByType(type: DomainEvent["eventType"], range?: TimeRange): AsyncIterable<DomainEvent>;
}
