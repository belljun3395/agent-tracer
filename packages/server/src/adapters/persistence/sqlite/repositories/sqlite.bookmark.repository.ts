import { desc, eq } from "drizzle-orm"

import type { IBookmarkRepository, BookmarkRecord, BookmarkSaveInput } from "~application/ports/repository/bookmark.repository.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { bookmarks, monitoringTasks, timelineEvents } from "../schema/drizzle.schema.js"
import { buildBookmarkSearchText, deleteSearchDocument, upsertSearchDocument } from "../search/sqlite.search.documents.js"
import { type BookmarkRow, mapBookmarkRow } from "./sqlite.bookmark.row.type.js"

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

  async findByTaskId(taskId: string): Promise<readonly BookmarkRecord[]> {
    const rows = this.selectBookmarks(taskId)
    return rows.map(mapBookmarkRow)
  }

  async findAll(): Promise<readonly BookmarkRecord[]> {
    const rows = this.selectBookmarks()
    return rows.map(mapBookmarkRow)
  }

  async delete(bookmarkId: string): Promise<void> {
    this.db.orm.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).run()
    deleteSearchDocument(this.db, "bookmark", bookmarkId)
  }

  private selectBookmarkById(id: string): BookmarkRow | undefined {
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

  private selectBookmarks(taskId?: string): readonly BookmarkRow[] {
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
