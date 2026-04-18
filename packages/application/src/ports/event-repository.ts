import type { BookmarkId, EventClassification, EventId, MonitoringEventKind, MonitoringTask, TaskId, TimelineEvent, TimelineLane } from "@monitor/domain";
export interface EventInsertInput {
    readonly id: EventId;
    readonly taskId: TaskId;
    readonly sessionId?: TimelineEvent["sessionId"];
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: EventClassification;
    readonly createdAt: string;
}
export interface SearchOptions {
    readonly taskId?: TaskId;
    readonly limit?: number;
}
export interface SearchTaskHit {
    readonly id: string;
    readonly taskId: TaskId;
    readonly title: string;
    readonly workspacePath?: string;
    readonly status: MonitoringTask["status"];
    readonly updatedAt: string;
}
export interface SearchEventHit {
    readonly id: string;
    readonly eventId: EventId;
    readonly taskId: TaskId;
    readonly taskTitle: string;
    readonly title: string;
    readonly snippet?: string;
    readonly lane: TimelineLane;
    readonly kind: MonitoringEventKind;
    readonly createdAt: string;
}
export interface SearchBookmarkHit {
    readonly id: string;
    readonly bookmarkId: BookmarkId;
    readonly taskId: TaskId;
    readonly eventId?: EventId;
    readonly kind: "task" | "event";
    readonly title: string;
    readonly note?: string;
    readonly taskTitle?: string;
    readonly eventTitle?: string;
    readonly createdAt: string;
}
export interface SearchResults {
    readonly tasks: readonly SearchTaskHit[];
    readonly events: readonly SearchEventHit[];
    readonly bookmarks: readonly SearchBookmarkHit[];
}
export interface IEventRepository {
    insert(input: EventInsertInput): Promise<TimelineEvent>;
    findById(id: EventId): Promise<TimelineEvent | null>;
    findByTaskId(taskId: TaskId): Promise<readonly TimelineEvent[]>;
    updateMetadata(eventId: EventId, metadata: Record<string, unknown>): Promise<TimelineEvent | null>;
    search(query: string, opts?: SearchOptions): Promise<SearchResults>;
}
