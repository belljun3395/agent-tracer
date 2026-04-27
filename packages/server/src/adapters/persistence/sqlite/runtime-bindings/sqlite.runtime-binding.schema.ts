// TODO(session-typeorm-migration): move this DDL into a proper migration once
// the project adopts TypeORM migrations across all modules. RuntimeBindingEntity
// uses `synchronize: false`, so the table is currently created here at startup.

import type Database from "better-sqlite3";

export function createRuntimeBindingSchema(db: Database.Database): void {
    db.exec(`
      create table if not exists runtime_bindings_current (
        runtime_source text not null,
        runtime_session_id text not null,
        task_id text not null references tasks_current(id) on delete cascade,
        monitor_session_id text references sessions_current(id) on delete set null,
        created_at text not null,
        updated_at text not null,
        primary key (runtime_source, runtime_session_id)
      );
    `);
}
