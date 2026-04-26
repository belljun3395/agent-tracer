import { and, desc, eq, isNotNull } from "drizzle-orm"

import type { IRuntimeBindingRepository, RuntimeBinding, RuntimeBindingUpsertInput } from "~application/ports/repository/runtime.binding.repository.js"
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js"
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js"
import { type RuntimeSessionBindingRow, mapRuntimeBindingRow } from "./sqlite.runtime.binding.row.type.js"
import { runtimeSessionBindings } from "./sqlite.runtime-binding.tables.js"

export class SqliteRuntimeBindingRepository implements IRuntimeBindingRepository {
  private readonly db: SqliteDatabase

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db)
  }

  async upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBinding> {
    const now = new Date().toISOString()

    this.db.client.transaction(() => {
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

      if (input.monitorSessionId) {
        appendDomainEvent(this.db.client, {
          eventTime: eventTimeFromIso(now),
          eventType: "session.bound",
          schemaVer: 1,
          aggregateId: input.taskId,
          sessionId: input.monitorSessionId,
          actor: "system",
          payload: {
            session_id: input.monitorSessionId,
            runtime_source: input.runtimeSource,
            runtime_session_id: input.runtimeSessionId
          }
        })
      }
    })()

    return (await this.find(input.runtimeSource, input.runtimeSessionId))!
  }

  async find(runtimeSource: string, runtimeSessionId: string): Promise<RuntimeBinding | null> {
    const row = this.db.orm
      .select()
      .from(runtimeSessionBindings)
      .where(and(
        eq(runtimeSessionBindings.runtimeSource, runtimeSource),
        eq(runtimeSessionBindings.runtimeSessionId, runtimeSessionId),
        isNotNull(runtimeSessionBindings.monitorSessionId)
      ))
      .limit(1)
      .get() as RuntimeSessionBindingRow | undefined

    return row ? mapRuntimeBindingRow(row) : null
  }

  async findTaskId(runtimeSource: string, runtimeSessionId: string): Promise<string | null> {
    const row = this.db.orm
      .select({ taskId: runtimeSessionBindings.taskId })
      .from(runtimeSessionBindings)
      .where(and(
        eq(runtimeSessionBindings.runtimeSource, runtimeSource),
        eq(runtimeSessionBindings.runtimeSessionId, runtimeSessionId)
      ))
      .limit(1)
      .get()

    return row?.taskId ? row.taskId : null
  }

  async findLatestByTaskId(taskId: string): Promise<{ runtimeSource: string; runtimeSessionId: string } | null> {
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
      runtimeSource: (row.runtimeSource).trim(),
      runtimeSessionId: row.runtimeSessionId
    } : null
  }

  async clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void> {
    this.db.orm
      .update(runtimeSessionBindings)
      .set({
        monitorSessionId: null,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(runtimeSessionBindings.runtimeSource, runtimeSource),
        eq(runtimeSessionBindings.runtimeSessionId, runtimeSessionId)
      ))
      .run()
  }

  async delete(runtimeSource: string, runtimeSessionId: string): Promise<void> {
    this.db.orm
      .delete(runtimeSessionBindings)
      .where(and(
        eq(runtimeSessionBindings.runtimeSource, runtimeSource),
        eq(runtimeSessionBindings.runtimeSessionId, runtimeSessionId)
      ))
      .run()
  }
}
