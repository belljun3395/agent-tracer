import type { AnyDomainEventDraft, DomainEvent, EventId, TimeRange } from "~domain/events/index.js";

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

export interface IEventStore {
    append(event: AnyDomainEventDraft): Promise<DomainEvent>;
    readAggregate(aggregateId: string, from?: EventId): AsyncIterable<DomainEvent>;
    readByType(type: DomainEvent["eventType"], range?: TimeRange): AsyncIterable<DomainEvent>;
    putContentBlob(input: ContentBlobWriteInput): Promise<ContentBlobRecord>;
    getContentBlob(sha256: string): Promise<ContentBlobRecord | null>;
}
