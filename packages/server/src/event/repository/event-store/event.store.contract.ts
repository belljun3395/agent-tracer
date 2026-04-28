/**
 * Event-store contracts. Module-internal: consumed by the SqliteEventStore
 * implementation and the DomainEventAppender public adapter.
 */
import type { AnyDomainEventDraft, DomainEvent } from "~domain/events/model/domain.events.model.js";
import type { EventId, TimeRange } from "~domain/events/model/event.model.js";

export interface ContentBlobWriteInput {
    readonly body: Buffer;
    readonly mime?: string;
    readonly createdAt?: number;
}

export interface ContentBlobRecord {
    readonly sha256: string;
    readonly byteSize: number;
    readonly mime?: string;
    readonly createdAt: number;
    readonly body: Buffer;
}

export interface DomainEventStorePort {
    append(event: AnyDomainEventDraft): Promise<DomainEvent>;
    readAggregate(aggregateId: string, from?: EventId): AsyncIterable<DomainEvent>;
    readByType(type: DomainEvent["eventType"], range?: TimeRange): AsyncIterable<DomainEvent>;
}

export interface ContentBlobStorePort {
    putContentBlob(input: ContentBlobWriteInput): Promise<ContentBlobRecord>;
    getContentBlob(sha256: string): Promise<ContentBlobRecord | null>;
}

export interface IEventStore extends DomainEventStorePort, ContentBlobStorePort {}
