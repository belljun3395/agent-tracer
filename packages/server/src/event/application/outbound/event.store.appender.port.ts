/**
 * Outbound port — append a domain event to the event-sourcing store after
 * a timeline event has been persisted. Self-contained.
 *
 * Adapter today: wraps legacy SqliteEventStore + mapTimelineInsertToDomainEvent.
 */

export interface DomainEventAppendInput {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: string;
}

export interface IEventStoreAppender {
    append(input: DomainEventAppendInput): Promise<void>;
}
