/**
 * @module infrastructure/monitor-database
 *
 * SQLite 기반 영속성 레이어.
 * better-sqlite3를 사용한 동기 API로 태스크·세션·이벤트를 저장.
 *
 * 의존성 방향: infrastructure → @monitor/core
 */

import fs from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import type {
  EventClassification,
  MonitoringEventKind,
  MonitoringSession,
  MonitoringTask,
  MonitoringTaskKind,
  TimelineEvent,
  TimelineLane
} from "@monitor/core";
import { normalizeLane } from "@monitor/core";

export interface MonitorDatabaseOptions {
  readonly filename: string;
}

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

interface CcSessionRow {
  cc_session_id: string;
  task_id: string;
  monitor_session_id: string | null;
  message_count: number;
  updated_at: string;
}

interface RuntimeSessionBindingRow {
  runtime_source: string;
  runtime_session_id: string;
  task_id: string;
  monitor_session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  task_id: string;
  status: MonitoringSession["status"];
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

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

interface BookmarkRow {
  id: string;
  task_id: string;
  event_id: string | null;
  kind: "task" | "event";
  title: string;
  note: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  task_title: string | null;
  event_title: string | null;
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

export interface BookmarkRecord {
  readonly id: string;
  readonly kind: "task" | "event";
  readonly taskId: string;
  readonly eventId?: string;
  readonly title: string;
  readonly note?: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly taskTitle?: string;
  readonly eventTitle?: string;
}

export interface SearchTaskHit {
  readonly id: string;
  readonly taskId: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly status: MonitoringTask["status"];
  readonly updatedAt: string;
}

export interface SearchEventHit {
  readonly id: string;
  readonly eventId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly title: string;
  readonly snippet?: string;
  readonly lane: TimelineLane;
  readonly kind: MonitoringEventKind;
  readonly createdAt: string;
}

export interface SearchBookmarkHit {
  readonly id: string;
  readonly bookmarkId: string;
  readonly taskId: string;
  readonly eventId?: string;
  readonly kind: "task" | "event";
  readonly title: string;
  readonly note?: string;
  readonly taskTitle?: string;
  readonly eventTitle?: string;
  readonly createdAt: string;
}

export interface SearchResults {
  readonly tasks: readonly SearchTaskHit[];
  readonly events: readonly SearchEventHit[];
  readonly bookmarks: readonly SearchBookmarkHit[];
}

export interface OverviewStats {
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly completedTasks: number;
  readonly erroredTasks: number;
  readonly totalEvents: number;
}

export interface EventInsertInput {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId?: string;
  readonly kind: MonitoringEventKind;
  readonly lane: TimelineLane;
  readonly title: string;
  readonly body?: string;
  readonly metadata: Record<string, unknown>;
  readonly classification: EventClassification;
  readonly createdAt: string;
}

/**
 * SQLite 기반 모니터링 데이터베이스.
 * 태스크·세션·타임라인 이벤트의 영속성을 담당.
 */
export class MonitorDatabase {
  /** better-sqlite3 연결 객체. 테스트에서 `.close()` 호출에 사용. */
  readonly connection: Database.Database;

  constructor(options: MonitorDatabaseOptions) {
    fs.mkdirSync(path.dirname(options.filename), { recursive: true });
    this.connection = new BetterSqlite3(options.filename);
    this.connection.pragma("journal_mode = WAL");
    this.migrate();
  }

  /** DB 스키마 마이그레이션: 테이블·인덱스 생성. */
  migrate(): void {
    this.connection.exec(`
      create table if not exists monitoring_tasks (
        id text primary key,
        title text not null,
        slug text not null,
        workspace_path text,
        status text not null,
        task_kind text not null default 'primary',
        parent_task_id text references monitoring_tasks(id) on delete cascade,
        parent_session_id text,
        background_task_id text,
        created_at text not null,
        updated_at text not null,
        last_session_started_at text,
        cli_source text
      );

      create table if not exists task_sessions (
        id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        status text not null,
        summary text,
        started_at text not null,
        ended_at text
      );

      create table if not exists timeline_events (
        id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        session_id text references task_sessions(id) on delete set null,
        kind text not null,
        lane text not null,
        title text not null,
        body text,
        metadata_json text not null,
        classification_json text not null,
        created_at text not null
      );

      create index if not exists idx_timeline_events_task_created
        on timeline_events(task_id, created_at);

      create table if not exists cc_sessions (
        cc_session_id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        monitor_session_id text,
        message_count integer not null default 0,
        updated_at text not null
      );

      create table if not exists runtime_session_bindings (
        runtime_source text not null,
        runtime_session_id text not null,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        monitor_session_id text,
        created_at text not null,
        updated_at text not null,
        primary key (runtime_source, runtime_session_id)
      );

      create table if not exists bookmarks (
        id text primary key,
        task_id text not null references monitoring_tasks(id) on delete cascade,
        event_id text references timeline_events(id) on delete cascade,
        kind text not null,
        title text not null,
        note text,
        metadata_json text not null default '{}',
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_bookmarks_task_created
        on bookmarks(task_id, updated_at desc);

      create index if not exists idx_bookmarks_event
        on bookmarks(event_id);
    `);

    // 점진적 마이그레이션: 기존 DB에 cli_source 컬럼이 없으면 추가
    const cols = this.connection.pragma("table_info(monitoring_tasks)") as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "cli_source")) {
      this.connection.exec("alter table monitoring_tasks add column cli_source text");
    }
    if (!cols.some((c) => c.name === "task_kind")) {
      this.connection.exec("alter table monitoring_tasks add column task_kind text not null default 'primary'");
    }
    if (!cols.some((c) => c.name === "parent_task_id")) {
      this.connection.exec("alter table monitoring_tasks add column parent_task_id text references monitoring_tasks(id) on delete set null");
    }
    if (!cols.some((c) => c.name === "parent_session_id")) {
      this.connection.exec("alter table monitoring_tasks add column parent_session_id text");
    }
    if (!cols.some((c) => c.name === "background_task_id")) {
      this.connection.exec("alter table monitoring_tasks add column background_task_id text");
    }
  }

  /**
   * 태스크를 삽입하거나 존재하면 업데이트(upsert)한다.
   * @param task 저장할 태스크 객체
   * @returns 저장 후 DB에서 조회한 태스크
   */
  upsertTask(task: MonitoringTask): MonitoringTask {
    this.connection
      .prepare(`
        insert into monitoring_tasks (
          id, title, slug, workspace_path, status, task_kind, parent_task_id, parent_session_id, background_task_id, created_at, updated_at, last_session_started_at, cli_source
        ) values (
          @id, @title, @slug, @workspacePath, @status, @taskKind, @parentTaskId, @parentSessionId, @backgroundTaskId, @createdAt, @updatedAt, @lastSessionStartedAt, @runtimeSource
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
      `)
      .run({
        id: task.id,
        title: task.title,
        slug: task.slug,
        workspacePath: task.workspacePath ?? null,
        status: task.status,
        taskKind: task.taskKind,
        parentTaskId: task.parentTaskId ?? null,
        parentSessionId: task.parentSessionId ?? null,
        backgroundTaskId: task.backgroundTaskId ?? null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        lastSessionStartedAt: task.lastSessionStartedAt ?? null,
        runtimeSource: task.runtimeSource ?? null
      });

    return this.getTask(task.id)!;
  }

  /**
   * 새 세션을 생성한다.
   * @param session 저장할 세션 객체
   * @returns 저장 후 DB에서 조회한 세션
   */
  createSession(session: MonitoringSession): MonitoringSession {
    this.connection
      .prepare(`
        insert into task_sessions (id, task_id, status, summary, started_at, ended_at)
        values (@id, @taskId, @status, @summary, @startedAt, @endedAt)
      `)
      .run({
        id: session.id,
        taskId: session.taskId,
        status: session.status,
        summary: session.summary ?? null,
        startedAt: session.startedAt,
        endedAt: session.endedAt ?? null
      });

    return this.getSession(session.id)!;
  }

  /**
   * 세션 상태를 업데이트한다.
   * @param sessionId 대상 세션 ID
   * @param status 새 상태
   * @param summary 선택적 요약 텍스트
   * @param endedAt 선택적 종료 시각 (ISO 8601)
   * @returns 업데이트된 세션, 없으면 undefined
   */
  updateSessionStatus(
    sessionId: string,
    status: MonitoringSession["status"],
    summary?: string,
    endedAt?: string
  ): MonitoringSession | undefined {
    this.connection
      .prepare(`
        update task_sessions
        set status = @status,
            summary = coalesce(@summary, summary),
            ended_at = coalesce(@endedAt, ended_at)
        where id = @sessionId
      `)
      .run({
        sessionId,
        status,
        summary: summary ?? null,
        endedAt: endedAt ?? null
      });

    return this.getSession(sessionId);
  }

  /**
   * 타임라인 이벤트를 추가한다.
   * @param event 삽입할 이벤트 입력
   * @returns 저장된 TimelineEvent
   */
  appendEvent(event: EventInsertInput): TimelineEvent {
    this.connection
      .prepare(`
        insert into timeline_events (
          id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at
        ) values (
          @id, @taskId, @sessionId, @kind, @lane, @title, @body, @metadataJson, @classificationJson, @createdAt
        )
      `)
      .run({
        id: event.id,
        taskId: event.taskId,
        sessionId: event.sessionId ?? null,
        kind: event.kind,
        lane: event.lane,
        title: event.title,
        body: event.body ?? null,
        metadataJson: JSON.stringify(event.metadata),
        classificationJson: JSON.stringify(event.classification),
        createdAt: event.createdAt
      });

    return this.getEvent(event.id)!;
  }

  /**
   * 모든 태스크를 최신순으로 반환한다.
   * @returns 태스크 배열
   */
  listTasks(): readonly MonitoringTask[] {
    return this.connection
      .prepare<[], TaskRow>(`
        select *
        from monitoring_tasks
        order by datetime(updated_at) desc
      `)
      .all()
      .map(mapTaskRow);
  }

  /**
   * 특정 태스크를 ID로 조회한다.
   * @param taskId 조회할 태스크 ID
   * @returns 태스크 또는 undefined
   */
  getTask(taskId: string): MonitoringTask | undefined {
    const row = this.connection
      .prepare<{ taskId: string }, TaskRow>(`
        select *
        from monitoring_tasks
        where id = @taskId
      `)
      .get({ taskId });

    return row ? mapTaskRow(row) : undefined;
  }

  updateTaskLink(input: {
    taskId: string;
    title?: string;
    slug?: string;
    taskKind?: MonitoringTaskKind;
    parentTaskId?: string;
    parentSessionId?: string;
    backgroundTaskId?: string;
    updatedAt: string;
  }): MonitoringTask | undefined {
    this.connection
      .prepare(`
        update monitoring_tasks
        set
          title = coalesce(@title, title),
          slug = coalesce(@slug, slug),
          task_kind = coalesce(@taskKind, task_kind),
          parent_task_id = coalesce(@parentTaskId, parent_task_id),
          parent_session_id = coalesce(@parentSessionId, parent_session_id),
          background_task_id = coalesce(@backgroundTaskId, background_task_id),
          updated_at = @updatedAt
        where id = @taskId
      `)
      .run({
        taskId: input.taskId,
        title: input.title ?? null,
        slug: input.slug ?? null,
        taskKind: input.taskKind ?? null,
        parentTaskId: input.parentTaskId ?? null,
        parentSessionId: input.parentSessionId ?? null,
        backgroundTaskId: input.backgroundTaskId ?? null,
        updatedAt: input.updatedAt
      });

    return this.getTask(input.taskId);
  }

  /**
   * 특정 세션을 ID로 조회한다.
   * @param sessionId 조회할 세션 ID
   * @returns 세션 또는 undefined
   */
  getSession(sessionId: string): MonitoringSession | undefined {
    const row = this.connection
      .prepare<{ sessionId: string }, SessionRow>(`
        select *
        from task_sessions
        where id = @sessionId
      `)
      .get({ sessionId });

    return row ? mapSessionRow(row) : undefined;
  }

  /**
   * 태스크의 최신 세션을 조회한다.
   * @param taskId 대상 태스크 ID
   * @returns 최신 세션 또는 undefined
   */
  findLatestSession(taskId: string): MonitoringSession | undefined {
    const row = this.connection
      .prepare<{ taskId: string }, SessionRow>(`
        select *
        from task_sessions
        where task_id = @taskId
        order by datetime(started_at) desc
        limit 1
      `)
      .get({ taskId });

    return row ? mapSessionRow(row) : undefined;
  }

  /**
   * 태스크에 속한 모든 세션을 시작 시각 순으로 반환한다.
   * @param taskId 대상 태스크 ID
   * @returns 세션 배열
   */
  listSessions(taskId: string): readonly MonitoringSession[] {
    return this.connection
      .prepare<{ taskId: string }, SessionRow>(`
        select *
        from task_sessions
        where task_id = @taskId
        order by datetime(started_at) asc
      `)
      .all({ taskId })
      .map(mapSessionRow);
  }

  countRunningSessions(taskId: string): number {
    const row = this.connection
      .prepare<{ taskId: string }, { count: number }>(`
        select count(*) as count
        from task_sessions
        where task_id = @taskId
          and status = 'running'
      `)
      .get({ taskId });

    return row?.count ?? 0;
  }

  countRawUserMessages(taskId: string): number {
    const row = this.connection
      .prepare<{ taskId: string }, { count: number }>(`
        select count(*) as count
        from timeline_events
        where task_id = @taskId
          and kind = 'user.message'
          and json_extract(metadata_json, '$.captureMode') = 'raw'
      `)
      .get({ taskId });
    return row?.count ?? 0;
  }

  /**
   * 태스크의 타임라인 이벤트 목록을 시간순으로 반환한다.
   * @param taskId 대상 태스크 ID
   * @returns 이벤트 배열
   */
  getTaskTimeline(taskId: string): readonly TimelineEvent[] {
    return this.connection
      .prepare<{ taskId: string }, EventRow>(`
        select *
        from timeline_events
        where task_id = @taskId
        order by datetime(created_at) asc
      `)
      .all({ taskId })
      .map(mapEventRow);
  }

  /**
   * 특정 이벤트를 ID로 조회한다.
   * @param eventId 조회할 이벤트 ID
   * @returns 이벤트 또는 undefined
   */
  getEvent(eventId: string): TimelineEvent | undefined {
    const row = this.connection
      .prepare<{ eventId: string }, EventRow>(`
        select *
        from timeline_events
        where id = @eventId
      `)
      .get({ eventId });

    return row ? mapEventRow(row) : undefined;
  }

  getBookmarkByTarget(taskId: string, eventId?: string): BookmarkRecord | undefined {
    const row = this.connection
      .prepare<{ taskId: string; eventId: string | null }, BookmarkRow>(`
        select
          b.*,
          t.title as task_title,
          e.title as event_title
        from bookmarks b
        join monitoring_tasks t on t.id = b.task_id
        left join timeline_events e on e.id = b.event_id
        where b.task_id = @taskId
          and (
            (@eventId is null and b.event_id is null)
            or b.event_id = @eventId
          )
        limit 1
      `)
      .get({ taskId, eventId: eventId ?? null });

    return row ? mapBookmarkRow(row) : undefined;
  }

  upsertBookmark(input: {
    id: string;
    taskId: string;
    eventId?: string;
    kind: "task" | "event";
    title: string;
    note?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }): BookmarkRecord {
    this.connection
      .prepare(`
        insert into bookmarks (
          id, task_id, event_id, kind, title, note, metadata_json, created_at, updated_at
        ) values (
          @id, @taskId, @eventId, @kind, @title, @note, @metadataJson, @createdAt, @updatedAt
        )
        on conflict(id) do update set
          task_id = excluded.task_id,
          event_id = excluded.event_id,
          kind = excluded.kind,
          title = excluded.title,
          note = excluded.note,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `)
      .run({
        id: input.id,
        taskId: input.taskId,
        eventId: input.eventId ?? null,
        kind: input.kind,
        title: input.title,
        note: input.note ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      });

    return this.listBookmarks(input.taskId).find((bookmark) => bookmark.id === input.id)!;
  }

  listBookmarks(taskId?: string): readonly BookmarkRecord[] {
    const rows = taskId
      ? this.connection
        .prepare<{ taskId: string }, BookmarkRow>(`
          select
            b.*,
            t.title as task_title,
            e.title as event_title
          from bookmarks b
          join monitoring_tasks t on t.id = b.task_id
          left join timeline_events e on e.id = b.event_id
          where b.task_id = @taskId
          order by datetime(b.updated_at) desc
        `)
        .all({ taskId })
      : this.connection
        .prepare<[], BookmarkRow>(`
          select
            b.*,
            t.title as task_title,
            e.title as event_title
          from bookmarks b
          join monitoring_tasks t on t.id = b.task_id
          left join timeline_events e on e.id = b.event_id
          order by datetime(b.updated_at) desc
        `)
        .all();

    return rows.map(mapBookmarkRow);
  }

  deleteBookmark(bookmarkId: string): "deleted" | "not_found" {
    const result = this.connection
      .prepare<{ bookmarkId: string }>("delete from bookmarks where id = @bookmarkId")
      .run({ bookmarkId });

    return result.changes > 0 ? "deleted" : "not_found";
  }

  search(query: string, limit = 8, taskId?: string): SearchResults {
    const pattern = `%${escapeLikePattern(query.trim().toLowerCase())}%`;
    const safeLimit = Math.max(1, Math.min(50, limit));

    const tasks = this.connection
      .prepare<{ pattern: string; limit: number }, SearchTaskRow>(`
        select id, title, workspace_path, status, updated_at
        from monitoring_tasks
        where lower(title) like @pattern escape '\\'
           or lower(coalesce(workspace_path, '')) like @pattern escape '\\'
        order by datetime(updated_at) desc
        limit @limit
      `)
      .all({ pattern, limit: safeLimit })
      .map((row) => ({
        id: row.id,
        taskId: row.id,
        title: row.title,
        status: row.status,
        updatedAt: row.updated_at,
        ...(row.workspace_path ? { workspacePath: row.workspace_path } : {})
      }));

    const events = this.connection
      .prepare<{ pattern: string; limit: number; taskId: string | null }, SearchEventRow>(`
        select
          e.id as event_id,
          e.task_id,
          t.title as task_title,
          e.title,
          e.body,
          e.lane,
          e.kind,
          e.created_at
        from timeline_events e
        join monitoring_tasks t on t.id = e.task_id
        where (
          lower(e.title) like @pattern escape '\\'
          or lower(coalesce(e.body, '')) like @pattern escape '\\'
          or lower(e.metadata_json) like @pattern escape '\\'
        )
          and (@taskId is null or e.task_id = @taskId)
        order by datetime(e.created_at) desc
        limit @limit
      `)
      .all({ pattern, limit: safeLimit, taskId: taskId ?? null })
      .map((row) => ({
        id: row.event_id,
        eventId: row.event_id,
        taskId: row.task_id,
        taskTitle: row.task_title,
        title: row.title,
        lane: normalizeLane(row.lane),
        kind: row.kind,
        createdAt: row.created_at,
        ...(row.body ? { snippet: row.body } : {})
      }));

    const bookmarks = this.connection
      .prepare<{ pattern: string; limit: number; taskId: string | null }, BookmarkRow>(`
        select
          b.*,
          t.title as task_title,
          e.title as event_title
        from bookmarks b
        join monitoring_tasks t on t.id = b.task_id
        left join timeline_events e on e.id = b.event_id
        where (
          lower(b.title) like @pattern escape '\\'
          or lower(coalesce(b.note, '')) like @pattern escape '\\'
          or lower(t.title) like @pattern escape '\\'
          or lower(coalesce(e.title, '')) like @pattern escape '\\'
        )
          and (@taskId is null or b.task_id = @taskId)
        order by datetime(b.updated_at) desc
        limit @limit
      `)
      .all({ pattern, limit: safeLimit, taskId: taskId ?? null })
      .map((row) => ({
        id: row.id,
        bookmarkId: row.id,
        taskId: row.task_id,
        kind: row.kind,
        title: row.title,
        createdAt: row.created_at,
        ...(row.event_id ? { eventId: row.event_id } : {}),
        ...(row.note ? { note: row.note } : {}),
        ...(row.task_title ? { taskTitle: row.task_title } : {}),
        ...(row.event_title ? { eventTitle: row.event_title } : {})
      }));

    return { tasks, events, bookmarks };
  }

  /**
   * 태스크를 삭제한다. 실행 중인 태스크는 삭제할 수 없다.
   * @param taskId 삭제할 태스크 ID
   * @returns "deleted" | "not_found" | "running"
   */
  deleteTask(taskId: string): "deleted" | "not_found" {
    return this.connection.transaction((): "deleted" | "not_found" => {
      const row = this.connection
        .prepare<{ taskId: string }, { status: string }>(
          "select status from monitoring_tasks where id = @taskId"
        )
        .get({ taskId });

      if (!row) return "not_found";

      const taskIds = [taskId, ...this.collectDescendantTaskIds(taskId)];
      this.deleteTasksByIds(taskIds);

      return "deleted";
    })();
  }

  /**
   * 완료·에러 상태의 모든 태스크를 삭제한다.
   * @returns 삭제된 태스크 수
   */
  deleteFinishedTasks(): number {
    const finishedTaskIds = this.connection
      .prepare<[], { id: string }>(`
        select id
        from monitoring_tasks
        where status in ('completed', 'errored')
      `)
      .all()
      .map((row) => row.id);

    if (finishedTaskIds.length === 0) {
      return 0;
    }

    const taskIdsToDelete = new Set<string>();
    for (const finishedTaskId of finishedTaskIds) {
      taskIdsToDelete.add(finishedTaskId);
      for (const descendantId of this.collectDescendantTaskIds(finishedTaskId)) {
        taskIdsToDelete.add(descendantId);
      }
    }

    this.deleteTasksByIds([...taskIdsToDelete]);
    return taskIdsToDelete.size;
  }

  private collectDescendantTaskIds(taskId: string): readonly string[] {
    return this.connection
      .prepare<{ taskId: string }, { id: string }>(`
        with recursive task_tree(id) as (
          select id
          from monitoring_tasks
          where id = @taskId

          union all

          select child.id
          from monitoring_tasks child
          join task_tree parent on child.parent_task_id = parent.id
        )
        select id
        from task_tree
        where id != @taskId
      `)
      .all({ taskId })
      .map((row) => row.id);
  }

  private deleteTasksByIds(taskIds: readonly string[]): void {
    if (taskIds.length === 0) {
      return;
    }

    const placeholders = taskIds.map(() => "?").join(", ");
    this.connection
      .prepare(`delete from timeline_events where task_id in (${placeholders})`)
      .run(...taskIds);
    this.connection
      .prepare(`delete from task_sessions where task_id in (${placeholders})`)
      .run(...taskIds);
    this.connection
      .prepare(`delete from cc_sessions where task_id in (${placeholders})`)
      .run(...taskIds);
    this.connection
      .prepare(`delete from runtime_session_bindings where task_id in (${placeholders})`)
      .run(...taskIds);
    this.connection
      .prepare(`delete from bookmarks where task_id in (${placeholders})`)
      .run(...taskIds);
    this.connection
      .prepare(`delete from monitoring_tasks where id in (${placeholders})`)
      .run(...taskIds);
  }

  /**
   * cc_sessions 레코드를 조회한다.
   */
  getCcSession(ccSessionId: string): CcSessionRow | null {
    return this.connection
      .prepare<{ ccSessionId: string }, CcSessionRow>(
        "select * from cc_sessions where cc_session_id = @ccSessionId"
      )
      .get({ ccSessionId }) ?? null;
  }

  /**
   * cc_sessions 레코드를 upsert한다.
   */
  upsertCcSession(row: CcSessionRow): void {
    this.connection
      .prepare<CcSessionRow>(`
        insert into cc_sessions (cc_session_id, task_id, monitor_session_id, message_count, updated_at)
        values (@cc_session_id, @task_id, @monitor_session_id, @message_count, @updated_at)
        on conflict(cc_session_id) do update set
          task_id = excluded.task_id,
          monitor_session_id = excluded.monitor_session_id,
          message_count = excluded.message_count,
          updated_at = excluded.updated_at
      `)
      .run(row);
  }

  /**
   * runtime_session_bindings 레코드를 조회한다.
   */
  getRuntimeSessionBinding(runtimeSource: string, runtimeSessionId: string): RuntimeSessionBindingRow | null {
    return this.connection
      .prepare<{ runtimeSource: string; runtimeSessionId: string }, RuntimeSessionBindingRow>(
        "select * from runtime_session_bindings where runtime_source = @runtimeSource and runtime_session_id = @runtimeSessionId"
      )
      .get({ runtimeSource, runtimeSessionId }) ?? null;
  }

  /**
   * runtime_session_bindings 레코드를 upsert한다.
   */
  upsertRuntimeSessionBinding(row: RuntimeSessionBindingRow): void {
    this.connection
      .prepare<RuntimeSessionBindingRow>(`
        insert into runtime_session_bindings (runtime_source, runtime_session_id, task_id, monitor_session_id, created_at, updated_at)
        values (@runtime_source, @runtime_session_id, @task_id, @monitor_session_id, @created_at, @updated_at)
        on conflict(runtime_source, runtime_session_id) do update set
          task_id = excluded.task_id,
          monitor_session_id = excluded.monitor_session_id,
          updated_at = excluded.updated_at
      `)
      .run(row);
  }

  /**
   * 전체 개요 통계를 반환한다.
   * @returns 태스크·이벤트 카운트 통계
   */
  getOverviewStats(): OverviewStats {
    const counts =
      this.connection
        .prepare<[], {
          total_tasks: number;
          running_tasks: number | null;
          completed_tasks: number | null;
          errored_tasks: number | null;
          total_events: number;
        }>(`
          select
            count(*) as total_tasks,
            sum(case when status = 'running' then 1 else 0 end) as running_tasks,
            sum(case when status = 'completed' then 1 else 0 end) as completed_tasks,
            sum(case when status = 'errored' then 1 else 0 end) as errored_tasks,
            (select count(*) from timeline_events) as total_events
          from monitoring_tasks
        `)
        .get() ?? {
        total_tasks: 0,
        running_tasks: 0,
        completed_tasks: 0,
        errored_tasks: 0,
        total_events: 0
      };

    return {
      totalTasks: counts.total_tasks,
      runningTasks: counts.running_tasks ?? 0,
      completedTasks: counts.completed_tasks ?? 0,
      erroredTasks: counts.errored_tasks ?? 0,
      totalEvents: counts.total_events
    };
  }
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
    ...(row.last_session_started_at
      ? { lastSessionStartedAt: row.last_session_started_at }
      : {}),
    ...(row.cli_source ? { runtimeSource: row.cli_source } : {})
  };
}

function mapSessionRow(row: SessionRow): MonitoringSession {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    startedAt: row.started_at,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {})
  };
}

function mapEventRow(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    kind: row.kind,
    lane: normalizeLane(row.lane),
    title: row.title,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    classification: JSON.parse(row.classification_json) as EventClassification,
    createdAt: row.created_at,
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(row.body ? { body: row.body } : {})
  };
}

function mapBookmarkRow(row: BookmarkRow): BookmarkRecord {
  return {
    id: row.id,
    kind: row.kind,
    taskId: row.task_id,
    title: row.title,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.event_id ? { eventId: row.event_id } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.task_title ? { taskTitle: row.task_title } : {}),
    ...(row.event_title ? { eventTitle: row.event_title } : {})
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
