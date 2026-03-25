/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-event-repository
 *
 * IEventRepository SQLite 구현.
 */

import type Database from "better-sqlite3";
import type {
  EventClassification,
  MonitoringEventKind,
  MonitoringTask,
  TimelineEvent,
  TimelineLane
} from "@monitor/core";
import { normalizeLane } from "@monitor/core";

import type {
  IEventRepository,
  EventInsertInput,
  SearchOptions,
  SearchResults
} from "../../application/ports/event-repository.js";
import { parseJsonField } from "./sqlite-json.js";

interface EventRow {
  id: string;
  task_id: string;
  session_id: string | null;
  kind: MonitoringEventKind;
  lane: TimelineLane;
  title: string;
  body: string | null;
  metadata_json: string;
  classification_json: string;
  created_at: string;
}

interface SearchTaskRow {
  id: string;
  title: string;
  workspace_path: string | null;
  status: MonitoringTask["status"];
  updated_at: string;
}

interface SearchEventRow {
  event_id: string;
  task_id: string;
  task_title: string;
  title: string;
  body: string | null;
  lane: TimelineLane;
  kind: MonitoringEventKind;
  created_at: string;
}

interface SearchBookmarkRow {
  id: string;
  task_id: string;
  event_id: string | null;
  kind: "task" | "event";
  title: string;
  note: string | null;
  created_at: string;
  task_title: string | null;
  event_title: string | null;
}

function mapEventRow(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    kind: row.kind,
    lane: normalizeLane(row.lane),
    title: row.title,
    metadata: parseJsonField<Record<string, unknown>>(row.metadata_json),
    classification: parseJsonField<EventClassification>(row.classification_json),
    createdAt: row.created_at,
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(row.body ? { body: row.body } : {})
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export class SqliteEventRepository implements IEventRepository {
  constructor(private readonly db: Database.Database) {}

  async insert(input: EventInsertInput): Promise<TimelineEvent> {
    this.db.prepare(`
      insert into timeline_events (id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at)
      values (@id, @taskId, @sessionId, @kind, @lane, @title, @body, @metadataJson, @classificationJson, @createdAt)
    `).run({
      id: input.id,
      taskId: input.taskId,
      sessionId: input.sessionId ?? null,
      kind: input.kind,
      lane: input.lane,
      title: input.title,
      body: input.body ?? null,
      metadataJson: JSON.stringify(input.metadata),
      classificationJson: JSON.stringify(input.classification),
      createdAt: input.createdAt
    });
    return (await this.findById(input.id))!;
  }

  async findById(id: string): Promise<TimelineEvent | null> {
    const row = this.db
      .prepare<{ id: string }, EventRow>("select * from timeline_events where id = @id")
      .get({ id });
    return row ? mapEventRow(row) : null;
  }

  async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
    return this.db
      .prepare<{ taskId: string }, EventRow>(
        "select * from timeline_events where task_id = @taskId order by datetime(created_at) asc"
      )
      .all({ taskId })
      .map(mapEventRow);
  }

  async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null> {
    const existing = await this.findById(eventId);
    if (!existing) {
      return null;
    }

    this.db.prepare(`
      update timeline_events
      set metadata_json = @metadataJson
      where id = @id
    `).run({
      id: eventId,
      metadataJson: JSON.stringify(metadata)
    });

    return this.findById(eventId);
  }

  async countRawUserMessages(taskId: string): Promise<number> {
    const row = this.db
      .prepare<{ taskId: string }, { count: number }>(
        "select count(*) as count from timeline_events where task_id = @taskId and kind = 'user.message' and json_extract(metadata_json, '$.captureMode') = 'raw'"
      )
      .get({ taskId });
    return row?.count ?? 0;
  }

  async search(query: string, opts?: SearchOptions): Promise<SearchResults> {
    const pattern = `%${escapeLikePattern(query.trim().toLowerCase())}%`;
    const safeLimit = Math.max(1, Math.min(50, opts?.limit ?? 8));
    const taskId = opts?.taskId ?? null;

    const tasks = this.db
      .prepare<{ pattern: string; limit: number }, SearchTaskRow>(`
        select id, title, workspace_path, status, updated_at
        from monitoring_tasks
        where lower(title) like @pattern escape '\\'
           or lower(coalesce(workspace_path, '')) like @pattern escape '\\'
        order by datetime(updated_at) desc
        limit @limit
      `)
      .all({ pattern, limit: safeLimit })
      .map((r) => ({ id: r.id, taskId: r.id, title: r.title, status: r.status, updatedAt: r.updated_at, ...(r.workspace_path ? { workspacePath: r.workspace_path } : {}) }));

    const events = this.db
      .prepare<{ pattern: string; limit: number; taskId: string | null }, SearchEventRow>(`
        select e.id as event_id, e.task_id, t.title as task_title, e.title, e.body, e.lane, e.kind, e.created_at
        from timeline_events e
        join monitoring_tasks t on t.id = e.task_id
        where (lower(e.title) like @pattern escape '\\' or lower(coalesce(e.body, '')) like @pattern escape '\\' or lower(e.metadata_json) like @pattern escape '\\')
          and (@taskId is null or e.task_id = @taskId)
        order by datetime(e.created_at) desc
        limit @limit
      `)
      .all({ pattern, limit: safeLimit, taskId })
      .map((r) => ({ id: r.event_id, eventId: r.event_id, taskId: r.task_id, taskTitle: r.task_title, title: r.title, lane: normalizeLane(r.lane), kind: r.kind, createdAt: r.created_at, ...(r.body ? { snippet: r.body } : {}) }));

    const bookmarks = this.db
      .prepare<{ pattern: string; limit: number; taskId: string | null }, SearchBookmarkRow>(`
        select b.id, b.task_id, b.event_id, b.kind, b.title, b.note, b.created_at, t.title as task_title, e.title as event_title
        from bookmarks b
        join monitoring_tasks t on t.id = b.task_id
        left join timeline_events e on e.id = b.event_id
        where (lower(b.title) like @pattern escape '\\' or lower(coalesce(b.note, '')) like @pattern escape '\\' or lower(t.title) like @pattern escape '\\' or lower(coalesce(e.title, '')) like @pattern escape '\\')
          and (@taskId is null or b.task_id = @taskId)
        order by datetime(b.created_at) desc
        limit @limit
      `)
      .all({ pattern, limit: safeLimit, taskId })
      .map((r) => ({ id: r.id, bookmarkId: r.id, taskId: r.task_id, kind: r.kind, title: r.title, createdAt: r.created_at, ...(r.event_id ? { eventId: r.event_id } : {}), ...(r.note ? { note: r.note } : {}), ...(r.task_title ? { taskTitle: r.task_title } : {}), ...(r.event_title ? { eventTitle: r.event_title } : {}) }));

    return { tasks, events, bookmarks };
  }
}
