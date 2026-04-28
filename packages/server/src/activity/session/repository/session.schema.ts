import type Database from "better-sqlite3";

const SESSION_DDL = `
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

  create table if not exists runtime_bindings_current (
    runtime_source text not null,
    runtime_session_id text not null,
    task_id text not null references tasks_current(id) on delete cascade,
    monitor_session_id text references sessions_current(id) on delete set null,
    created_at text not null,
    updated_at text not null,
    primary key (runtime_source, runtime_session_id)
  );
`;

export function createSessionSchema(db: Database.Database): void {
    db.exec(SESSION_DDL);
}
