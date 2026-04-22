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

