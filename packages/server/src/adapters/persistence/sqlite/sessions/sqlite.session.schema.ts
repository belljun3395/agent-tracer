// TODO(session-typeorm-migration): move this DDL into a proper migration once
// the project adopts TypeORM migrations across all modules. SessionEntity uses
// `synchronize: false`, so the table is currently created here at startup.
// When migrating, replace this with `npm run typeorm migration:run` or similar.

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
