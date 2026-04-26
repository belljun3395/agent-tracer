import type { AnyDomainEventDraft, DomainEvent, EventId, TimeRange } from "~domain/events/index.js";

export interface DomainEventStorePort {
    append(event: AnyDomainEventDraft): Promise<DomainEvent>;
    readAggregate(aggregateId: string, from?: EventId): AsyncIterable<DomainEvent>;
    readByType(type: DomainEvent["eventType"], range?: TimeRange): AsyncIterable<DomainEvent>;
}
