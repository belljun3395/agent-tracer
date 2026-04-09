/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-bookmark-repository
 *
 * IBookmarkRepository SQLite 구현.
 */

import type Database from "better-sqlite3";

import type { IBookmarkRepository, BookmarkRecord, BookmarkSaveInput } from "../../application/ports";
import { parseJsonField } from "./sqlite-json.js";
import {
  buildBookmarkSearchText,
  deleteSearchDocument,
  upsertSearchDocument
} from "./sqlite-search-documents.js";

interface BookmarkRow {
  id: string;
  task_id: string;
  event_id: string | null;
  kind: "task" | "event";
  title: string;
  note: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  task_title: string | null;
  event_title: string | null;
}

function mapBookmarkRow(row: BookmarkRow): BookmarkRecord {
  return {
    id: row.id,
    kind: row.kind,
    taskId: row.task_id,
    title: row.title,
    metadata: parseJsonField(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.event_id ? { eventId: row.event_id } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.task_title ? { taskTitle: row.task_title } : {}),
    ...(row.event_title ? { eventTitle: row.event_title } : {})
  };
}

const BOOKMARK_SELECT = `
  select b.*, t.title as task_title, e.title as event_title
  from bookmarks b
  join monitoring_tasks t on t.id = b.task_id
  left join timeline_events e on e.id = b.event_id
`;

export class SqliteBookmarkRepository implements IBookmarkRepository {
  constructor(private readonly db: Database.Database) {}

  async save(input: BookmarkSaveInput): Promise<BookmarkRecord> {
    const now = new Date().toISOString();
    this.db.prepare(`
      insert into bookmarks (id, task_id, event_id, kind, title, note, metadata_json, created_at, updated_at)
      values (@id, @taskId, @eventId, @kind, @title, @note, @metadataJson, @createdAt, @updatedAt)
      on conflict(id) do update set
        task_id = excluded.task_id,
        event_id = excluded.event_id,
        kind = excluded.kind,
        title = excluded.title,
        note = excluded.note,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run({
      id: input.id,
      taskId: input.taskId,
      eventId: input.eventId ?? null,
      kind: input.kind,
      title: input.title,
      note: input.note ?? null,
      metadataJson: JSON.stringify(input.metadata),
      createdAt: now,
      updatedAt: now
    });
    const row = this.db
      .prepare<{ id: string }, BookmarkRow>(`${BOOKMARK_SELECT} where b.id = @id`)
      .get({ id: input.id });
    if (row) {
      upsertSearchDocument(this.db, {
        scope: "bookmark",
        entityId: row.id,
        taskId: row.task_id,
        searchText: buildBookmarkSearchText({
          kind: row.kind,
          title: row.title,
          note: row.note,
          taskTitle: row.task_title,
          eventTitle: row.event_title
        }),
        updatedAt: row.updated_at
      });
    }
    return mapBookmarkRow(row!);
  }

  async findByTaskId(taskId: string): Promise<readonly BookmarkRecord[]> {
    return this.db
      .prepare<{ taskId: string }, BookmarkRow>(`${BOOKMARK_SELECT} where b.task_id = @taskId order by datetime(b.updated_at) desc`)
      .all({ taskId })
      .map(mapBookmarkRow);
  }

  async findAll(): Promise<readonly BookmarkRecord[]> {
    return this.db
      .prepare<[], BookmarkRow>(`${BOOKMARK_SELECT} order by datetime(b.updated_at) desc`)
      .all()
      .map(mapBookmarkRow);
  }

  async delete(bookmarkId: string): Promise<void> {
    this.db.prepare("delete from bookmarks where id = @bookmarkId").run({ bookmarkId });
    deleteSearchDocument(this.db, "bookmark", bookmarkId);
  }
}
