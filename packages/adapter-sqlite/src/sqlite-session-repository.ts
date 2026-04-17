import { asc, desc, eq, sql } from "drizzle-orm"
import type { MonitoringSession, SessionId as MonitorSessionId, TaskId as MonitorTaskId } from "@monitor/core"
import { SessionId, TaskId } from "@monitor/core"

import type { ISessionRepository, SessionCreateInput } from "@monitor/application"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "./drizzle-db.js"
import { taskSessions } from "./drizzle-schema.js"

interface SessionRow {
  id: string
  taskId: string
  status: string
  summary: string | null
  startedAt: string
  endedAt: string | null
}

function mapSessionRow(row: SessionRow): MonitoringSession {
  return {
    id: SessionId(row.id),
    taskId: TaskId(row.taskId),
    status: row.status as MonitoringSession["status"],
    startedAt: row.startedAt,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.endedAt ? { endedAt: row.endedAt } : {})
  }
}

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

  async findById(id: MonitorSessionId): Promise<MonitoringSession | null> {
    const row = this.db.orm
      .select()
      .from(taskSessions)
      .where(eq(taskSessions.id, id))
      .limit(1)
      .get() as SessionRow | undefined

    return row ? mapSessionRow(row) : null
  }

  async findByTaskId(taskId: MonitorTaskId): Promise<readonly MonitoringSession[]> {
    const rows = this.db.orm
      .select()
      .from(taskSessions)
      .where(eq(taskSessions.taskId, taskId))
      .orderBy(asc(taskSessions.startedAt))
      .all() as readonly SessionRow[]

    return rows.map(mapSessionRow)
  }

  async findActiveByTaskId(taskId: MonitorTaskId): Promise<MonitoringSession | null> {
    const row = this.db.orm
      .select()
      .from(taskSessions)
      .where(sql`${taskSessions.taskId} = ${taskId} and ${taskSessions.status} = 'running'`)
      .orderBy(desc(taskSessions.startedAt))
      .limit(1)
      .get() as SessionRow | undefined

    return row ? mapSessionRow(row) : null
  }

  async updateStatus(id: MonitorSessionId, status: MonitoringSession["status"], endedAt: string, summary?: string): Promise<void> {
    this.db.orm
      .update(taskSessions)
      .set(summary == null ? { status, endedAt } : { status, summary, endedAt })
      .where(eq(taskSessions.id, id))
      .run()
  }

  async countRunningByTaskId(taskId: MonitorTaskId): Promise<number> {
    const row = this.db.orm
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(taskSessions)
      .where(sql`${taskSessions.taskId} = ${taskId} and ${taskSessions.status} = 'running'`)
      .get()

    return row?.count ?? 0
  }
}
