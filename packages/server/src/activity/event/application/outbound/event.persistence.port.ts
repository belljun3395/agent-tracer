import type { MonitoringEventKind, TimelineLane } from "~activity/event/domain/common/const/event.kind.const.js";
import type {
    EventClassificationMatch,
    TimelineEvent,
} from "~activity/event/domain/model/timeline.event.model.js";

/** Outbound port for timeline event persistence. */

export type PersistedTimelineEvent = TimelineEvent;

export interface TimelineEventInsertRequest {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: TimelineLane;
        readonly tags: readonly string[];
        readonly matches: readonly EventClassificationMatch[];
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
