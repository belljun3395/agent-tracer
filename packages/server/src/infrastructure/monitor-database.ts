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
  created_at: string;
  updated_at: string;
  last_session_started_at: string | null;
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
        created_at text not null,
        updated_at text not null,
        last_session_started_at text
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
    `);
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
          id, title, slug, workspace_path, status, created_at, updated_at, last_session_started_at
        ) values (
          @id, @title, @slug, @workspacePath, @status, @createdAt, @updatedAt, @lastSessionStartedAt
        )
        on conflict(id) do update set
          title = excluded.title,
          slug = excluded.slug,
          workspace_path = excluded.workspace_path,
          status = excluded.status,
          updated_at = excluded.updated_at,
          last_session_started_at = excluded.last_session_started_at
      `)
      .run({
        id: task.id,
        title: task.title,
        slug: task.slug,
        workspacePath: task.workspacePath ?? null,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        lastSessionStartedAt: task.lastSessionStartedAt ?? null
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

  /**
   * 태스크를 삭제한다. 실행 중인 태스크는 삭제할 수 없다.
   * @param taskId 삭제할 태스크 ID
   * @returns "deleted" | "not_found" | "running"
   */
  deleteTask(taskId: string): "deleted" | "not_found" | "running" {
    return this.connection.transaction((): "deleted" | "not_found" | "running" => {
      const row = this.connection
        .prepare<{ taskId: string }, { status: string }>(
          "select status from monitoring_tasks where id = @taskId"
        )
        .get({ taskId });

      if (!row) return "not_found";
      if (row.status === "running") return "running";

      this.connection
        .prepare<{ taskId: string }>("delete from monitoring_tasks where id = @taskId")
        .run({ taskId });

      return "deleted";
    })();
  }

  /**
   * 완료·에러 상태의 모든 태스크를 삭제한다.
   * @returns 삭제된 태스크 수
   */
  deleteFinishedTasks(): number {
    const result = this.connection
      .prepare("delete from monitoring_tasks where status in ('completed', 'errored')")
      .run();

    return result.changes;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
    ...(row.last_session_started_at
      ? { lastSessionStartedAt: row.last_session_started_at }
      : {})
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
