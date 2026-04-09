import { desc, eq, sql } from "drizzle-orm"
import { RuntimeSessionId, RuntimeSource, SessionId, TaskId, type RuntimeSessionId as MonitorRuntimeSessionId, type RuntimeSource as MonitorRuntimeSource, type TaskId as MonitorTaskId } from "@monitor/core"

import type { IRuntimeBindingRepository, RuntimeBinding, RuntimeBindingUpsertInput } from "../../application/ports/index.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "./drizzle-db.js"
import { runtimeSessionBindings } from "./drizzle-schema.js"

interface RuntimeSessionBindingRow {
  runtimeSource: string
  runtimeSessionId: string
  taskId: string
  monitorSessionId: string | null
  createdAt: string
  updatedAt: string
}

function mapRow(row: RuntimeSessionBindingRow): RuntimeBinding {
  return {
    runtimeSource: RuntimeSource(row.runtimeSource),
    runtimeSessionId: RuntimeSessionId(row.runtimeSessionId),
    taskId: TaskId(row.taskId),
    monitorSessionId: SessionId(row.monitorSessionId!),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class SqliteRuntimeBindingRepository implements IRuntimeBindingRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  async upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBinding> {
    const now = new Date().toISOString()

    this.db.orm
      .insert(runtimeSessionBindings)
      .values({
        runtimeSource: input.runtimeSource,
        runtimeSessionId: input.runtimeSessionId,
        taskId: input.taskId,
        monitorSessionId: input.monitorSessionId,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [runtimeSessionBindings.runtimeSource, runtimeSessionBindings.runtimeSessionId],
        set: {
          taskId: input.taskId,
          monitorSessionId: input.monitorSessionId,
          updatedAt: now
        }
      })
      .run()

    return (await this.find(input.runtimeSource, input.runtimeSessionId))!
  }

  async find(runtimeSource: MonitorRuntimeSource, runtimeSessionId: MonitorRuntimeSessionId): Promise<RuntimeBinding | null> {
    const row = this.db.orm
      .select()
      .from(runtimeSessionBindings)
      .where(sql`${runtimeSessionBindings.runtimeSource} = ${runtimeSource}
        and ${runtimeSessionBindings.runtimeSessionId} = ${runtimeSessionId}
        and ${runtimeSessionBindings.monitorSessionId} is not null`)
      .limit(1)
      .get() as RuntimeSessionBindingRow | undefined

    return row ? mapRow(row) : null
  }

  async findTaskId(runtimeSource: MonitorRuntimeSource, runtimeSessionId: MonitorRuntimeSessionId): Promise<MonitorTaskId | null> {
    const row = this.db.orm
      .select({ taskId: runtimeSessionBindings.taskId })
      .from(runtimeSessionBindings)
      .where(sql`${runtimeSessionBindings.runtimeSource} = ${runtimeSource}
        and ${runtimeSessionBindings.runtimeSessionId} = ${runtimeSessionId}`)
      .limit(1)
      .get()

    return row?.taskId ? TaskId(row.taskId) : null
  }

  async findLatestByTaskId(taskId: MonitorTaskId): Promise<{ runtimeSource: MonitorRuntimeSource; runtimeSessionId: MonitorRuntimeSessionId } | null> {
    const row = this.db.orm
      .select({
        runtimeSource: runtimeSessionBindings.runtimeSource,
        runtimeSessionId: runtimeSessionBindings.runtimeSessionId
      })
      .from(runtimeSessionBindings)
      .where(eq(runtimeSessionBindings.taskId, taskId))
      .orderBy(desc(runtimeSessionBindings.updatedAt))
      .limit(1)
      .get()

    return row ? {
      runtimeSource: RuntimeSource(row.runtimeSource),
      runtimeSessionId: RuntimeSessionId(row.runtimeSessionId)
    } : null
  }

  async clearSession(runtimeSource: MonitorRuntimeSource, runtimeSessionId: MonitorRuntimeSessionId): Promise<void> {
    this.db.orm
      .update(runtimeSessionBindings)
      .set({
        monitorSessionId: null,
        updatedAt: new Date().toISOString()
      })
      .where(sql`${runtimeSessionBindings.runtimeSource} = ${runtimeSource}
        and ${runtimeSessionBindings.runtimeSessionId} = ${runtimeSessionId}`)
      .run()
  }

  async delete(runtimeSource: MonitorRuntimeSource, runtimeSessionId: MonitorRuntimeSessionId): Promise<void> {
    this.db.orm
      .delete(runtimeSessionBindings)
      .where(sql`${runtimeSessionBindings.runtimeSource} = ${runtimeSource}
        and ${runtimeSessionBindings.runtimeSessionId} = ${runtimeSessionId}`)
      .run()
  }
}
