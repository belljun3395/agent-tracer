/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-session-repository
 *
 * ISessionRepository SQLite 구현.
 */

import type Database from "better-sqlite3";
import type { MonitoringSession } from "@monitor/core";
import { SessionId, TaskId } from "@monitor/core";

import type { ISessionRepository, SessionCreateInput } from "../../application/ports";

interface SessionRow {
  id: string;
  task_id: string;
  status: MonitoringSession["status"];
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

function mapSessionRow(row: SessionRow): MonitoringSession {
  return {
    id: SessionId(row.id),
    taskId: TaskId(row.task_id),
    status: row.status,
    startedAt: row.started_at,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {})
  };
}

export class SqliteSessionRepository implements ISessionRepository {
  constructor(private readonly db: Database.Database) {}

  async create(input: SessionCreateInput): Promise<MonitoringSession> {
    this.db.prepare(
      "insert into task_sessions (id, task_id, status, summary, started_at, ended_at) values (@id, @taskId, @status, @summary, @startedAt, @endedAt)"
    ).run({
      id: input.id,
      taskId: input.taskId,
      status: input.status,
      summary: input.summary ?? null,
      startedAt: input.startedAt,
      endedAt: null
    });
    return (await this.findById(input.id))!;
  }

  async findById(id: string): Promise<MonitoringSession | null> {
    const row = this.db
      .prepare<{ id: string }, SessionRow>("select * from task_sessions where id = @id")
      .get({ id });
    return row ? mapSessionRow(row) : null;
  }

  async findByTaskId(taskId: string): Promise<readonly MonitoringSession[]> {
    return this.db
      .prepare<{ taskId: string }, SessionRow>(
        "select * from task_sessions where task_id = @taskId order by datetime(started_at) asc"
      )
      .all({ taskId })
      .map(mapSessionRow);
  }

  async findActiveByTaskId(taskId: string): Promise<MonitoringSession | null> {
    const row = this.db
      .prepare<{ taskId: string }, SessionRow>(
        "select * from task_sessions where task_id = @taskId and status = 'running' order by datetime(started_at) desc limit 1"
      )
      .get({ taskId });
    return row ? mapSessionRow(row) : null;
  }

  async updateStatus(id: string, status: MonitoringSession["status"], endedAt: string, summary?: string): Promise<void> {
    this.db.prepare(
      "update task_sessions set status = @status, summary = coalesce(@summary, summary), ended_at = coalesce(@endedAt, ended_at) where id = @id"
    ).run({ id, status, summary: summary ?? null, endedAt });
  }

  async countRunningByTaskId(taskId: string): Promise<number> {
    const row = this.db
      .prepare<{ taskId: string }, { count: number }>(
        "select count(*) as count from task_sessions where task_id = @taskId and status = 'running'"
      )
      .get({ taskId });
    return row?.count ?? 0;
  }
}
