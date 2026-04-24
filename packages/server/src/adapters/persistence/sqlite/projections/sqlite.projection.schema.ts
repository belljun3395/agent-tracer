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
        created_at text not null,
        updated_at text not null,
        last_session_started_at text,
        cli_source text
      );

      create index if not exists idx_tasks_current_updated
        on tasks_current(updated_at desc);

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

      create table if not exists task_relations (
        task_id text not null references tasks_current(id) on delete cascade,
        related_task_id text references tasks_current(id) on delete cascade,
        relation_kind text not null check(relation_kind in ('parent','background','spawned_by_session')),
        session_id text,
        check (
          (relation_kind in ('parent','background') and related_task_id is not null and session_id is null)
          or
          (relation_kind = 'spawned_by_session' and related_task_id is null and session_id is not null)
        )
      );

      create unique index if not exists idx_task_relations_task_related
        on task_relations(task_id, relation_kind, related_task_id)
        where related_task_id is not null;

      create unique index if not exists idx_task_relations_task_session
        on task_relations(task_id, relation_kind, session_id)
        where session_id is not null;

      create index if not exists idx_task_relations_related
        on task_relations(related_task_id, relation_kind);
    `);
}
