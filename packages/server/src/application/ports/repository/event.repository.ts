import type {
    EventClassification,
    MonitoringEventKind,
    MonitoringTask,
    TimelineEvent,
    TimelineLane,
} from "~domain/index.js";
export interface EventInsertInput {
    readonly id: string;
    readonly taskId: string;
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
    readonly taskId?: string;
    readonly limit?: number;
}
export interface SearchTaskHit {
    readonly id: string;
    readonly taskId: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly status: MonitoringTask["status"];
    readonly updatedAt: string;
}
export interface SearchEventHit {
    readonly id: string;
    readonly eventId: string;
    readonly taskId: string;
    readonly taskTitle: string;
    readonly title: string;
    readonly snippet?: string;
    readonly lane: TimelineLane;
    readonly kind: MonitoringEventKind;
    readonly createdAt: string;
}
export interface SearchBookmarkHit {
    readonly id: string;
    readonly bookmarkId: string;
    readonly taskId: string;
    readonly eventId?: string;
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
    findById(id: string): Promise<TimelineEvent | null>;
    findByTaskId(taskId: string): Promise<readonly TimelineEvent[]>;
    updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null>;
    search(query: string, opts?: SearchOptions): Promise<SearchResults>;
}
