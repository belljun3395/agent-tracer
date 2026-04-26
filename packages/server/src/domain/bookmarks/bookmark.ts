import type { TimelineEvent } from "../monitoring/event/model/timeline.event.model.js";
import type { MonitoringTask } from "../monitoring/task/model/task.model.js";
import type { BookmarkDraft, BookmarkDraftInput } from "./model/bookmark.model.js";

export function assertBookmarkEventBelongsToTask(event: TimelineEvent, task: MonitoringTask): void {
    if (event.taskId !== task.id) {
        throw new Error(`Bookmark event ${event.id} does not belong to task ${task.id}`);
    }
}

export function createBookmarkDraft(input: BookmarkDraftInput): BookmarkDraft {
    if (input.event) assertBookmarkEventBelongsToTask(input.event, input.task);
    const title = input.title?.trim() || input.event?.title || input.task.title;
    const note = input.note?.trim();
    return {
        id: input.id,
        taskId: input.task.id,
        ...(input.event ? { eventId: input.event.id } : {}),
        kind: input.event ? "event" : "task",
        title,
        ...(note ? { note } : {}),
        metadata: input.metadata ?? {},
    };
}

export function isSameBookmarkTarget(
    bookmark: { readonly taskId: string; readonly eventId?: string },
    target: { readonly taskId: string; readonly eventId?: string },
): boolean {
    return bookmark.taskId === target.taskId &&
        (target.eventId ? bookmark.eventId === target.eventId : !bookmark.eventId);
}
