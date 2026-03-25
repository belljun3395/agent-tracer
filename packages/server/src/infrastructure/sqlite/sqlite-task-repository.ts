/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-task-repository
 *
 * ITaskRepository SQLite 구현.
 */

import type Database from "better-sqlite3";
import type { EventClassification, MonitoringEventKind, MonitoringTask, MonitoringTaskKind, TimelineLane } from "@monitor/core";

import type { ITaskRepository, OverviewStats, TaskUpsertInput } from "../../application/ports/task-repository.js";
import { deriveTaskDisplayTitle } from "../../application/services/task-display-title-resolver.helpers.js";
import { parseJsonField } from "./sqlite-json.js";

interface TaskRow {
  id: string;
  title: string;
  slug: string;
  workspace_path: string | null;
  status: MonitoringTask["status"];
  task_kind: MonitoringTaskKind;
  parent_task_id: string | null;
  parent_session_id: string | null;
  background_task_id: string | null;
  created_at: string;
  updated_at: string;
  last_session_started_at: string | null;
  cli_source: string | null;
}

interface EventKindRow {
  id: string;
  lane: string;
  kind: string;
  title: string;
  body: string | null;
  metadata_json: string;
  classification_json: string;
  created_at: string;
  task_id: string;
  session_id: string | null;
}

function mapTaskRow(row: TaskRow): MonitoringTask {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    taskKind: row.task_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
    ...(row.parent_task_id ? { parentTaskId: row.parent_task_id } : {}),
    ...(row.parent_session_id ? { parentSessionId: row.parent_session_id } : {}),
    ...(row.background_task_id ? { backgroundTaskId: row.background_task_id } : {}),
    ...(row.last_session_started_at ? { lastSessionStartedAt: row.last_session_started_at } : {}),
    ...(row.cli_source ? { runtimeSource: row.cli_source } : {})
  };
}

export class SqliteTaskRepository implements ITaskRepository {
  constructor(private readonly db: Database.Database) {}

  private withDisplayTitle(task: MonitoringTask): MonitoringTask {
    // Only load events if title is generic
    const row = this.db
      .prepare<{ taskId: string }, { title: string | null }>(
        "select title from monitoring_tasks where id = @taskId"
      )
      .get({ taskId: task.id });
    if (!row) return task;

    // Check if we need events for title inference
    const events = this.loadEventsForTitle(task);
    const displayTitle = deriveTaskDisplayTitle(task, events);
    return displayTitle ? { ...task, displayTitle } : task;
  }

  private loadEventsForTitle(task: MonitoringTask) {
    // Only load events if title might be generic (avoid DB round-trip otherwise)
    return this.db
      .prepare<{ taskId: string }, EventKindRow>(
        "select id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at from timeline_events where task_id = @taskId order by datetime(created_at) asc"
      )
        .all({ taskId: task.id })
        .map((r) => ({
          id: r.id,
          taskId: r.task_id,
          kind: r.kind as MonitoringEventKind,
          lane: r.lane as TimelineLane,
          title: r.title,
          metadata: parseJsonField<Record<string, unknown>>(r.metadata_json),
          classification: parseJsonField<EventClassification>(r.classification_json),
          createdAt: r.created_at,
          ...(r.session_id ? { sessionId: r.session_id } : {}),
          ...(r.body ? { body: r.body } : {})
        }));
  }

  async upsert(input: TaskUpsertInput): Promise<MonitoringTask> {
    this.db.prepare(`
      insert into monitoring_tasks (
        id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id,
        background_task_id, created_at, updated_at, last_session_started_at, cli_source
      ) values (
        @id, @title, @slug, @workspacePath, @status, @taskKind, @parentTaskId, @parentSessionId,
        @backgroundTaskId, @createdAt, @updatedAt, @lastSessionStartedAt, @runtimeSource
      )
      on conflict(id) do update set
        title = excluded.title,
        slug = excluded.slug,
        workspace_path = excluded.workspace_path,
        status = excluded.status,
        task_kind = excluded.task_kind,
        parent_task_id = excluded.parent_task_id,
        parent_session_id = excluded.parent_session_id,
        background_task_id = excluded.background_task_id,
        updated_at = excluded.updated_at,
        last_session_started_at = excluded.last_session_started_at,
        cli_source = coalesce(excluded.cli_source, monitoring_tasks.cli_source)
    `).run({
      id: input.id,
      title: input.title,
      slug: input.slug,
      workspacePath: input.workspacePath ?? null,
      status: input.status,
      taskKind: input.taskKind,
      parentTaskId: input.parentTaskId ?? null,
      parentSessionId: input.parentSessionId ?? null,
      backgroundTaskId: input.backgroundTaskId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      lastSessionStartedAt: input.lastSessionStartedAt ?? null,
      runtimeSource: input.runtimeSource ?? null
    });
    const task = await this.findById(input.id);
    return task!;
  }

  async findById(id: string): Promise<MonitoringTask | null> {
    const row = this.db
      .prepare<{ id: string }, TaskRow>("select * from monitoring_tasks where id = @id")
      .get({ id });
    if (!row) return null;
    return this.withDisplayTitle(mapTaskRow(row));
  }

  async findAll(): Promise<readonly MonitoringTask[]> {
    return this.db
      .prepare<[], TaskRow>("select * from monitoring_tasks order by datetime(updated_at) desc")
      .all()
      .map((row) => this.withDisplayTitle(mapTaskRow(row)));
  }

  async findChildren(parentId: string): Promise<readonly MonitoringTask[]> {
    return this.db
      .prepare<{ parentId: string }, TaskRow>(
        "select * from monitoring_tasks where parent_task_id = @parentId order by datetime(updated_at) desc"
      )
      .all({ parentId })
      .map((row) => this.withDisplayTitle(mapTaskRow(row)));
  }

  async updateStatus(id: string, status: MonitoringTask["status"], updatedAt: string): Promise<void> {
    this.db
      .prepare<{ id: string; status: string; updatedAt: string }>(
        "update monitoring_tasks set status = @status, updated_at = @updatedAt where id = @id"
      )
      .run({ id, status, updatedAt });
  }

  async updateTitle(id: string, title: string, slug: string, updatedAt: string): Promise<void> {
    this.db
      .prepare<{ id: string; title: string; slug: string; updatedAt: string }>(
        "update monitoring_tasks set title = @title, slug = @slug, updated_at = @updatedAt where id = @id"
      )
      .run({ id, title, slug, updatedAt });
  }

  async delete(id: string): Promise<{ deletedIds: readonly string[] }> {
    return this.db.transaction((): { deletedIds: readonly string[] } => {
      const row = this.db
        .prepare<{ id: string }, { status: string }>("select status from monitoring_tasks where id = @id")
        .get({ id });
      if (!row) return { deletedIds: [] };
      const taskIds = [id, ...this.collectDescendantIds(id)];
      this.deleteByIds(taskIds);
      return { deletedIds: taskIds };
    })();
  }

  async deleteFinished(): Promise<number> {
    const finishedIds = this.db
      .prepare<[], { id: string }>("select id from monitoring_tasks where status in ('completed', 'errored')")
      .all()
      .map((r) => r.id);
    if (finishedIds.length === 0) return 0;
    const allIds = new Set<string>();
    for (const fid of finishedIds) {
      allIds.add(fid);
      for (const did of this.collectDescendantIds(fid)) allIds.add(did);
    }
    this.deleteByIds([...allIds]);
    return allIds.size;
  }

  async getOverviewStats(): Promise<OverviewStats> {
    const counts = this.db
      .prepare<[], { total_tasks: number; running_tasks: number | null; waiting_tasks: number | null; completed_tasks: number | null; errored_tasks: number | null; total_events: number }>(`
        select
          count(*) as total_tasks,
          sum(case when status = 'running' then 1 else 0 end) as running_tasks,
          sum(case when status = 'waiting' then 1 else 0 end) as waiting_tasks,
          sum(case when status = 'completed' then 1 else 0 end) as completed_tasks,
          sum(case when status = 'errored' then 1 else 0 end) as errored_tasks,
          (select count(*) from timeline_events) as total_events
        from monitoring_tasks
      `)
      .get() ?? { total_tasks: 0, running_tasks: 0, waiting_tasks: 0, completed_tasks: 0, errored_tasks: 0, total_events: 0 };
    return {
      totalTasks: counts.total_tasks,
      runningTasks: counts.running_tasks ?? 0,
      waitingTasks: counts.waiting_tasks ?? 0,
      completedTasks: counts.completed_tasks ?? 0,
      erroredTasks: counts.errored_tasks ?? 0,
      totalEvents: counts.total_events
    };
  }

  private collectDescendantIds(taskId: string): readonly string[] {
    return this.db
      .prepare<{ taskId: string }, { id: string }>(`
        with recursive task_tree(id) as (
          select id from monitoring_tasks where id = @taskId
          union all
          select child.id from monitoring_tasks child join task_tree parent on child.parent_task_id = parent.id
        )
        select id from task_tree where id != @taskId
      `)
      .all({ taskId })
      .map((r) => r.id);
  }

  private deleteByIds(taskIds: readonly string[]): void {
    if (taskIds.length === 0) return;
    const ph = taskIds.map(() => "?").join(", ");
    this.db.prepare(`delete from timeline_events where task_id in (${ph})`).run(...taskIds);
    this.db.prepare(`delete from task_sessions where task_id in (${ph})`).run(...taskIds);
    this.db.prepare(`delete from runtime_session_bindings where task_id in (${ph})`).run(...taskIds);
    this.db.prepare(`delete from bookmarks where task_id in (${ph})`).run(...taskIds);
    this.db.prepare(`delete from monitoring_tasks where id in (${ph})`).run(...taskIds);
  }
}
