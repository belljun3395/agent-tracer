import type { BookmarkRecord } from "~application/ports/repository/bookmark.repository.js";
import { parseJsonField } from "../shared/sqlite.json";

export interface BookmarkRow {
    id: string;
    taskId: string;
    eventId: string | null;
    kind: "task" | "event";
    title: string;
    note: string | null;
    metadataJson: string;
    createdAt: string;
    updatedAt: string;
    taskTitle: string | null;
    eventTitle: string | null;
}

export function mapBookmarkRow(row: BookmarkRow): BookmarkRecord {
    return {
        id: row.id,
        kind: row.kind,
        taskId: row.taskId,
        title: row.title,
        metadata: parseJsonField(row.metadataJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        ...(row.eventId ? { eventId: row.eventId } : {}),
        ...(row.note ? { note: row.note } : {}),
        ...(row.taskTitle ? { taskTitle: row.taskTitle } : {}),
        ...(row.eventTitle ? { eventTitle: row.eventTitle } : {}),
    };
}
