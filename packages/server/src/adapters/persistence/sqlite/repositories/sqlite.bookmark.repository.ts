import { desc, eq } from "drizzle-orm"

import type { IBookmarkRepository, BookmarkRecord, BookmarkSaveInput } from "~application/ports/repository/bookmark.repository.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { bookmarks, tasksCurrent, timelineEvents } from "../schema/drizzle.schema.js"
import { buildBookmarkSearchText, deleteSearchDocument, upsertSearchDocument } from "../search/sqlite.search.documents.js"
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js"
import { type BookmarkRow, mapBookmarkRow } from "./sqlite.bookmark.row.type.js"

export class SqliteBookmarkRepository implements IBookmarkRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  async save(input: BookmarkSaveInput): Promise<BookmarkRecord> {
    const now = new Date().toISOString()

    this.db.client.transaction(() => {
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

      appendDomainEvent(this.db.client, {
        eventTime: eventTimeFromIso(now),
        eventType: "bookmark.added",
        schemaVer: 1,
        aggregateId: input.taskId,
        actor: "user",
        payload: {
          task_id: input.taskId,
          bookmark_id: input.id,
          ...(input.eventId ? { event_id_ref: input.eventId } : {}),
          kind: input.kind,
          title: input.title,
          ...(input.note ? { note: input.note } : {}),
          metadata: input.metadata
        }
      })
    })()

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
    const row = this.selectBookmarkById(bookmarkId)
    this.db.client.transaction(() => {
      this.db.orm.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).run()
      if (row) {
        appendDomainEvent(this.db.client, {
          eventTime: eventTimeFromIso(new Date().toISOString()),
          eventType: "bookmark.removed",
          schemaVer: 1,
          aggregateId: row.taskId,
          actor: "user",
          payload: { bookmark_id: bookmarkId }
        })
      }
      deleteSearchDocument(this.db, "bookmark", bookmarkId)
    })()
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
        taskTitle: tasksCurrent.title,
        eventTitle: timelineEvents.title
      })
      .from(bookmarks)
      .innerJoin(tasksCurrent, eq(tasksCurrent.id, bookmarks.taskId))
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
        taskTitle: tasksCurrent.title,
        eventTitle: timelineEvents.title
      })
      .from(bookmarks)
      .innerJoin(tasksCurrent, eq(tasksCurrent.id, bookmarks.taskId))
      .leftJoin(timelineEvents, eq(timelineEvents.id, bookmarks.eventId))
      .orderBy(desc(bookmarks.updatedAt))

    if (!taskId) {
      return baseQuery.all() as readonly BookmarkRow[]
    }

    return baseQuery.where(eq(bookmarks.taskId, taskId)).all() as readonly BookmarkRow[]
  }
}
