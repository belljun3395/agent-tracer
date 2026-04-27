/**
 * Outbound port for timeline event persistence. Self-contained.
 * Adapter wraps the legacy SqliteEventRepository today; will be replaced
 * by a TypeORM-backed implementation once the schema is migrated.
 */

export type EventLane =
    | "user"
    | "exploration"
    | "implementation"
    | "planning"
    | "coordination"
    | "background";

export interface PersistedTimelineEvent {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: EventLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: EventLane;
        readonly tags: readonly string[];
        readonly matches: readonly unknown[];
    };
    readonly createdAt: string;
}

export interface TimelineEventInsertRequest {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: EventLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: EventLane;
        readonly tags: readonly string[];
        readonly matches: readonly unknown[];
    };
    readonly createdAt: string;
}

export interface EventSearchOptions {
    readonly taskId?: string;
    readonly limit?: number;
}

export interface EventSearchResults {
    readonly tasks: readonly unknown[];
    readonly events: readonly unknown[];
    readonly bookmarks: readonly unknown[];
}

export interface IEventPersistence {
    findById(id: string): Promise<PersistedTimelineEvent | null>;
    findByTaskId(taskId: string): Promise<readonly PersistedTimelineEvent[]>;
    insert(input: TimelineEventInsertRequest): Promise<PersistedTimelineEvent>;
    updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<PersistedTimelineEvent | null>;
    search(query: string, options: EventSearchOptions): Promise<EventSearchResults>;
}
