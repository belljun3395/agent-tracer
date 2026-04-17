import type { BookmarkId, EventId, TaskId } from "@monitor/domain";
export interface BookmarkRecord {
    readonly id: BookmarkId;
    readonly kind: "task" | "event";
    readonly taskId: TaskId;
    readonly eventId?: EventId;
    readonly title: string;
    readonly note?: string;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly taskTitle?: string;
    readonly eventTitle?: string;
}
export interface BookmarkSaveInput {
    readonly id: BookmarkId;
    readonly taskId: TaskId;
    readonly eventId?: EventId;
    readonly kind: "task" | "event";
    readonly title: string;
    readonly note?: string;
    readonly metadata: Record<string, unknown>;
}
export interface IBookmarkRepository {
    save(input: BookmarkSaveInput): Promise<BookmarkRecord>;
    findByTaskId(taskId: TaskId): Promise<readonly BookmarkRecord[]>;
    findAll(): Promise<readonly BookmarkRecord[]>;
    delete(bookmarkId: BookmarkId): Promise<void>;
}
