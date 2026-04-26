import type Database from "better-sqlite3";

export function createSessionSchema(db: Database.Database): void {
    db.exec(`
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
