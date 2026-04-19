import { and, asc, eq, sql } from "drizzle-orm"
import type { MonitoringSession } from "~domain/monitoring/monitoring.session.model.js"

import type { ISessionRepository, SessionCreateInput } from "~application/ports/repository/session.repository.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { taskSessions } from "../schema/drizzle.schema.js"
import { type SessionRow, mapSessionRow } from "./sqlite.session.row.type.js"

export class SqliteSessionRepository implements ISessionRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  async create(input: SessionCreateInput): Promise<MonitoringSession> {
    this.db.orm.insert(taskSessions).values({
      id: input.id,
      taskId: input.taskId,
      status: input.status,
      summary: input.summary ?? null,
      startedAt: input.startedAt,
      endedAt: null
    }).run()

    return (await this.findById(input.id))!
  }

  async findById(id: string): Promise<MonitoringSession | null> {
    const row = this.db.orm
      .select()
      .from(taskSessions)
      .where(eq(taskSessions.id, id))
      .limit(1)
      .get() as SessionRow | undefined

    return row ? mapSessionRow(row) : null
  }

  async findByTaskId(taskId: string): Promise<readonly MonitoringSession[]> {
    const rows = this.db.orm
      .select()
      .from(taskSessions)
      .where(eq(taskSessions.taskId, taskId))
      .orderBy(asc(taskSessions.startedAt))
      .all() as readonly SessionRow[]

    return rows.map(mapSessionRow)
  }

  async findActiveByTaskId(taskId: string): Promise<MonitoringSession | null> {
    const row = this.db.orm.query.taskSessions.findFirst({
      where: (fields, operators) => operators.and(
        operators.eq(fields.taskId, taskId),
        operators.eq(fields.status, "running")
      ),
      orderBy: (fields, operators) => operators.desc(fields.startedAt)
    }).sync() as SessionRow | undefined

    return row ? mapSessionRow(row) : null
  }

  async updateStatus(id: string, status: MonitoringSession["status"], endedAt: string, summary?: string): Promise<void> {
    this.db.orm
      .update(taskSessions)
      .set(summary == null ? { status, endedAt } : { status, summary, endedAt })
      .where(eq(taskSessions.id, id))
      .run()
  }

  async countRunningByTaskId(taskId: string): Promise<number> {
    const row = this.db.orm
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(taskSessions)
      .where(and(eq(taskSessions.taskId, taskId), eq(taskSessions.status, "running")))
      .get()

    return row?.count ?? 0
  }
}
