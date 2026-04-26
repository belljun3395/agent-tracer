import { and, asc, eq, sql } from "drizzle-orm"
import type { MonitoringSession } from "~domain/monitoring/index.js"

import type { ISessionRepository, SessionCreateInput } from "~application/ports/repository/session.repository.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { sessionsCurrent } from "../schema/drizzle.schema.js"
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js"
import { type SessionRow, mapSessionRow } from "./sqlite.session.row.type.js"

export class SqliteSessionRepository implements ISessionRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  async create(input: SessionCreateInput): Promise<MonitoringSession> {
    this.db.client.transaction(() => {
      appendDomainEvent(this.db.client, {
        eventTime: eventTimeFromIso(input.startedAt),
        eventType: "session.started",
        schemaVer: 1,
        aggregateId: input.taskId,
        sessionId: input.id,
        actor: "system",
        payload: {
          task_id: input.taskId,
          session_id: input.id
        }
      })
    })()

    return (await this.findById(input.id))!
  }

  async findById(id: string): Promise<MonitoringSession | null> {
    const row = this.db.orm
      .select()
      .from(sessionsCurrent)
      .where(eq(sessionsCurrent.id, id))
      .limit(1)
      .get() as SessionRow | undefined

    return row ? mapSessionRow(row) : null
  }

  async findByTaskId(taskId: string): Promise<readonly MonitoringSession[]> {
    const rows = this.db.orm
      .select()
      .from(sessionsCurrent)
      .where(eq(sessionsCurrent.taskId, taskId))
      .orderBy(asc(sessionsCurrent.startedAt))
      .all() as readonly SessionRow[]

    return rows.map(mapSessionRow)
  }

  async findActiveByTaskId(taskId: string): Promise<MonitoringSession | null> {
    const row = this.db.orm
      .select()
      .from(sessionsCurrent)
      .where(and(eq(sessionsCurrent.taskId, taskId), eq(sessionsCurrent.status, "running")))
      .orderBy(sql`${sessionsCurrent.startedAt} desc`)
      .limit(1)
      .get() as SessionRow | undefined

    return row ? mapSessionRow(row) : null
  }

  async updateStatus(id: string, status: MonitoringSession["status"], endedAt: string, summary?: string): Promise<void> {
    const existing = await this.findById(id)
    this.db.client.transaction(() => {
      if (existing) {
        appendDomainEvent(this.db.client, {
          eventTime: eventTimeFromIso(endedAt),
          eventType: "session.ended",
          schemaVer: 1,
          aggregateId: existing.taskId,
          sessionId: id,
          actor: "system",
          payload: {
            session_id: id,
            outcome: status,
            ...(summary ? { summary } : {})
          }
        })
      }
    })()
  }

  async countRunningByTaskId(taskId: string): Promise<number> {
    const row = this.db.orm
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(sessionsCurrent)
      .where(and(eq(sessionsCurrent.taskId, taskId), eq(sessionsCurrent.status, "running")))
      .get()

    return row?.count ?? 0
  }
}
