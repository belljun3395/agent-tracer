/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-runtime-binding-repository
 *
 * IRuntimeBindingRepository SQLite 구현.
 * cc_sessions 관련 코드는 포함하지 않는다.
 */

import type Database from "better-sqlite3";

import type { IRuntimeBindingRepository, RuntimeBinding, RuntimeBindingUpsertInput } from "../../application/ports/runtime-binding-repository.js";

interface RuntimeSessionBindingRow {
  runtime_source: string;
  runtime_session_id: string;
  task_id: string;
  monitor_session_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RuntimeSessionBindingRow): RuntimeBinding {
  return {
    runtimeSource: row.runtime_source,
    runtimeSessionId: row.runtime_session_id,
    taskId: row.task_id,
    monitorSessionId: row.monitor_session_id!,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SqliteRuntimeBindingRepository implements IRuntimeBindingRepository {
  constructor(private readonly db: Database.Database) {}

  async upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBinding> {
    const now = new Date().toISOString();
    this.db.prepare(`
      insert into runtime_session_bindings (runtime_source, runtime_session_id, task_id, monitor_session_id, created_at, updated_at)
      values (@runtimeSource, @runtimeSessionId, @taskId, @monitorSessionId, @createdAt, @updatedAt)
      on conflict(runtime_source, runtime_session_id) do update set
        task_id = excluded.task_id,
        monitor_session_id = excluded.monitor_session_id,
        updated_at = excluded.updated_at
    `).run({
      runtimeSource: input.runtimeSource,
      runtimeSessionId: input.runtimeSessionId,
      taskId: input.taskId,
      monitorSessionId: input.monitorSessionId ?? null,
      createdAt: now,
      updatedAt: now
    });
    return (await this.find(input.runtimeSource, input.runtimeSessionId))!;
  }

  async find(runtimeSource: string, runtimeSessionId: string): Promise<RuntimeBinding | null> {
    const row = this.db
      .prepare<{ runtimeSource: string; runtimeSessionId: string }, RuntimeSessionBindingRow>(
        "select * from runtime_session_bindings where runtime_source = @runtimeSource and runtime_session_id = @runtimeSessionId and monitor_session_id is not null"
      )
      .get({ runtimeSource, runtimeSessionId });
    return row ? mapRow(row) : null;
  }

  async findTaskId(runtimeSource: string, runtimeSessionId: string): Promise<string | null> {
    const row = this.db
      .prepare<{ runtimeSource: string; runtimeSessionId: string }, { task_id: string }>(
        "select task_id from runtime_session_bindings where runtime_source = @runtimeSource and runtime_session_id = @runtimeSessionId"
      )
      .get({ runtimeSource, runtimeSessionId });
    return row?.task_id ?? null;
  }

  async findLatestByTaskId(taskId: string): Promise<{ runtimeSource: string; runtimeSessionId: string } | null> {
    const row = this.db
      .prepare<{ taskId: string }, { runtime_source: string; runtime_session_id: string }>(
        "select runtime_source, runtime_session_id from runtime_session_bindings where task_id = @taskId order by datetime(updated_at) desc limit 1"
      )
      .get({ taskId });
    return row ? { runtimeSource: row.runtime_source, runtimeSessionId: row.runtime_session_id } : null;
  }

  async clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void> {
    this.db.prepare(
      "update runtime_session_bindings set monitor_session_id = null, updated_at = @updatedAt where runtime_source = @runtimeSource and runtime_session_id = @runtimeSessionId"
    ).run({ runtimeSource, runtimeSessionId, updatedAt: new Date().toISOString() });
  }

  async delete(runtimeSource: string, runtimeSessionId: string): Promise<void> {
    this.db.prepare(
      "delete from runtime_session_bindings where runtime_source = @runtimeSource and runtime_session_id = @runtimeSessionId"
    ).run({ runtimeSource, runtimeSessionId });
  }
}
