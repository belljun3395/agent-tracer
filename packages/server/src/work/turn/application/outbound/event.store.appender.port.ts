/**
 * Outbound port — append a domain event to the event-sourcing store after
 * a turn partition is updated or reset. Self-contained.
 *
 * Adapter today wraps the legacy SqliteEventStore.
 */

export interface PartitionUpdatedEvent {
    readonly type: "turn.partition_updated";
    readonly taskId: string;
    readonly updatedAt: string;
    readonly version: number;
    readonly groups: ReadonlyArray<{
        readonly id: string;
        readonly from: number;
        readonly to: number;
        readonly label: string | null;
        readonly visible: boolean;
    }>;
}

export interface PartitionResetEvent {
    readonly type: "turn.partition_reset";
    readonly taskId: string;
    readonly resetAt: string;
}

export type TurnPartitionDomainEvent = PartitionUpdatedEvent | PartitionResetEvent;

export interface IEventStoreAppender {
    append(event: TurnPartitionDomainEvent): void;
}
