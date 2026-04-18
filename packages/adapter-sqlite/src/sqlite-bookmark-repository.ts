import { desc, eq } from "drizzle-orm"
import { BookmarkId, EventId, TaskId, type BookmarkId as MonitorBookmarkId, type TaskId as MonitorTaskId } from "@monitor/domain"

import type { IBookmarkRepository, BookmarkRecord, BookmarkSaveInput } from "@monitor/application"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "./drizzle-db.js"
import { bookmarks, monitoringTasks, timelineEvents } from "./drizzle-schema.js"
import { parseJsonField } from "./sqlite-json.js"
import { buildBookmarkSearchText, deleteSearchDocument, upsertSearchDocument } from "./sqlite-search-documents.js"

interface BookmarkRow {
  id: string
  taskId: string
  eventId: string | null
  kind: "task" | "event"
  title: string
  note: string | null
  metadataJson: string
  createdAt: string
  updatedAt: string
  taskTitle: string | null
  eventTitle: string | null
}

function mapBookmarkRow(row: BookmarkRow): BookmarkRecord {
  return {
    id: BookmarkId(row.id),
    kind: row.kind,
    taskId: TaskId(row.taskId),
    title: row.title,
    metadata: parseJsonField(row.metadataJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.eventId ? { eventId: EventId(row.eventId) } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.taskTitle ? { taskTitle: row.taskTitle } : {}),
    ...(row.eventTitle ? { eventTitle: row.eventTitle } : {})
  }
}

export class SqliteBookmarkRepository implements IBookmarkRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  async save(input: BookmarkSaveInput): Promise<BookmarkRecord> {
    const now = new Date().toISOString()

    this.db.orm
      .insert(bookmarks)
      .values({
        id: input.id,
        taskId: input.taskId,
        eventId: input.eventId ?? null,
        kind: input.kind,
        title: input.title,
        note: input.note ?? null,
        metadataJson: JSON.stringify(input.metadata),
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: bookmarks.id,
        set: {
          taskId: input.taskId,
          eventId: input.eventId ?? null,
          kind: input.kind,
          title: input.title,
          note: input.note ?? null,
          metadataJson: JSON.stringify(input.metadata),
          updatedAt: now
        }
      })
      .run()

    const row = this.selectBookmarkById(input.id)
    if (row) {
      upsertSearchDocument(this.db, {
        scope: "bookmark",
        entityId: row.id,
        taskId: row.taskId,
        searchText: buildBookmarkSearchText({
          kind: row.kind,
          title: row.title,
          note: row.note,
          taskTitle: row.taskTitle,
          eventTitle: row.eventTitle
        }),
        updatedAt: row.updatedAt
      })
    }

    return mapBookmarkRow(row!)
  }

  async findByTaskId(taskId: MonitorTaskId): Promise<readonly BookmarkRecord[]> {
    const rows = this.selectBookmarks(taskId)
    return rows.map(mapBookmarkRow)
  }

  async findAll(): Promise<readonly BookmarkRecord[]> {
    const rows = this.selectBookmarks()
    return rows.map(mapBookmarkRow)
  }

  async delete(bookmarkId: MonitorBookmarkId): Promise<void> {
    this.db.orm.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).run()
    deleteSearchDocument(this.db, "bookmark", bookmarkId)
  }

  private selectBookmarkById(id: MonitorBookmarkId): BookmarkRow | undefined {
    return this.db.orm
      .select({
        id: bookmarks.id,
        taskId: bookmarks.taskId,
        eventId: bookmarks.eventId,
        kind: bookmarks.kind,
        title: bookmarks.title,
        note: bookmarks.note,
        metadataJson: bookmarks.metadataJson,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        taskTitle: monitoringTasks.title,
        eventTitle: timelineEvents.title
      })
      .from(bookmarks)
      .innerJoin(monitoringTasks, eq(monitoringTasks.id, bookmarks.taskId))
      .leftJoin(timelineEvents, eq(timelineEvents.id, bookmarks.eventId))
      .where(eq(bookmarks.id, id))
      .limit(1)
      .get() as BookmarkRow | undefined
  }

  private selectBookmarks(taskId?: MonitorTaskId): readonly BookmarkRow[] {
    const baseQuery = this.db.orm
      .select({
        id: bookmarks.id,
        taskId: bookmarks.taskId,
        eventId: bookmarks.eventId,
        kind: bookmarks.kind,
        title: bookmarks.title,
        note: bookmarks.note,
        metadataJson: bookmarks.metadataJson,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        taskTitle: monitoringTasks.title,
        eventTitle: timelineEvents.title
      })
      .from(bookmarks)
      .innerJoin(monitoringTasks, eq(monitoringTasks.id, bookmarks.taskId))
      .leftJoin(timelineEvents, eq(timelineEvents.id, bookmarks.eventId))
      .orderBy(desc(bookmarks.updatedAt))

    if (!taskId) {
      return baseQuery.all() as readonly BookmarkRow[]
    }

    return baseQuery.where(eq(bookmarks.taskId, taskId)).all() as readonly BookmarkRow[]
  }
}
