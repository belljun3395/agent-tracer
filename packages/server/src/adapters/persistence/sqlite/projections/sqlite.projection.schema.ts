import type Database from "better-sqlite3";

export function createProjectionSchema(db: Database.Database): void {
    db.exec(`
      create table if not exists tasks_current (
        id text primary key,
        title text not null,
        slug text not null,
        workspace_path text,
        status text not null,
        task_kind text not null default 'primary',
        parent_task_id text,
        parent_session_id text,
        background_task_id text,
        created_at text not null,
        updated_at text not null,
        last_session_started_at text,
        cli_source text
      );

      create index if not exists idx_tasks_current_updated
        on tasks_current(updated_at desc);

      create index if not exists idx_tasks_current_parent
        on tasks_current(parent_task_id, updated_at desc);

      create table if not exists sessions_current (
        id text primary key,
        task_id text not null,
        status text not null,
        summary text,
        started_at text not null,
        ended_at text
      );

      create index if not exists idx_sessions_current_task_started
        on sessions_current(task_id, started_at);

      create index if not exists idx_sessions_current_task_status_started
        on sessions_current(task_id, status, started_at desc);
    `);
}

export function backfillCurrentProjections(db: Database.Database): void {
    if (tableExists(db, "monitoring_tasks")) {
        db.exec(`
          insert into tasks_current (
            id, title, slug, workspace_path, status, task_kind, parent_task_id,
            parent_session_id, background_task_id, created_at, updated_at,
            last_session_started_at, cli_source
          )
          select
            id, title, slug, workspace_path, status, task_kind, parent_task_id,
            parent_session_id, background_task_id, created_at, updated_at,
            last_session_started_at, cli_source
          from monitoring_tasks
          where true
          on conflict(id) do update set
            title = excluded.title,
            slug = excluded.slug,
            workspace_path = excluded.workspace_path,
            status = excluded.status,
            task_kind = excluded.task_kind,
            parent_task_id = excluded.parent_task_id,
            parent_session_id = excluded.parent_session_id,
            background_task_id = excluded.background_task_id,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            last_session_started_at = excluded.last_session_started_at,
            cli_source = coalesce(excluded.cli_source, tasks_current.cli_source);
        `);
    }

    if (tableExists(db, "task_sessions")) {
        db.exec(`
          insert into sessions_current (
            id, task_id, status, summary, started_at, ended_at
          )
          select id, task_id, status, summary, started_at, ended_at
          from task_sessions
          where true
          on conflict(id) do update set
            task_id = excluded.task_id,
            status = excluded.status,
            summary = excluded.summary,
            started_at = excluded.started_at,
            ended_at = excluded.ended_at;
        `);
    }
}

export function dropLegacyTaskSessionTables(db: Database.Database): void {
    db.exec(`
      drop table if exists task_sessions;
      drop table if exists monitoring_tasks;
    `);
}

function tableExists(db: Database.Database, tableName: string): boolean {
    const row = db.prepare<{ tableName: string }, { name: string }>(
        "select name from sqlite_master where type = 'table' and name = @tableName",
    ).get({ tableName });
    return Boolean(row);
}
