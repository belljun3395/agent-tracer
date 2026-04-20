import type Database from "better-sqlite3";
export function createSchema(db: Database.Database): void {
    db.exec(`
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

    create table if not exists search_documents (
      scope text not null check(scope in ('task', 'event', 'bookmark')),
      entity_id text not null,
      task_id text,
      search_text text not null,
      embedding text,
      embedding_model text,
      updated_at text not null,
      primary key (scope, entity_id)
    );

    create index if not exists idx_search_documents_scope_task_updated
      on search_documents(scope, task_id, updated_at desc);

    create table if not exists task_evaluations (
      task_id       text not null references monitoring_tasks(id) on delete cascade,
      scope_key     text not null default 'task',
      scope_kind    text not null default 'task' check(scope_kind in ('task', 'turn')),
      scope_label   text not null default 'Whole task',
      turn_index    integer,
      rating        text not null check(rating in ('good', 'skip')),
      use_case      text,
      workflow_tags text,
      outcome_note  text,
      approach_note text,
      reuse_when    text,
      watchouts     text,
      version       integer not null default 1,
      promoted_to   text,
      reuse_count   integer not null default 0,
      last_reused_at text,
      briefing_copy_count integer not null default 0,
      workflow_snapshot_json text,
      workflow_context text,
      search_text   text,
      embedding     text,
      embedding_model text,
      evaluated_at  text not null,
      primary key (task_id, scope_key)
    );

    create index if not exists idx_task_evaluations_rating
      on task_evaluations(rating);

    create table if not exists playbooks (
      id text primary key,
      title text not null,
      slug text unique not null,
      status text not null default 'draft',
      when_to_use text,
      prerequisites text,
      approach text,
      key_steps text,
      watchouts text,
      anti_patterns text,
      failure_modes text,
      variants text,
      related_playbook_ids text,
      source_snapshot_ids text,
      tags text,
      search_text text,
      embedding text,
      embedding_model text,
      use_count integer not null default 0,
      last_used_at text,
      created_at text not null,
      updated_at text not null
    );

    create index if not exists idx_playbooks_status
      on playbooks(status);

    create table if not exists briefings (
      id text primary key,
      task_id text not null references monitoring_tasks(id) on delete cascade,
      generated_at text not null,
      purpose text not null,
      format text not null,
      memo text,
      content text not null
    );

    create index if not exists idx_briefings_task_generated
      on briefings(task_id, generated_at desc);

    create table if not exists rule_commands (
      id text primary key,
      pattern text not null,
      label text not null,
      task_id text references monitoring_tasks(id) on delete cascade,
      created_at text not null
    );

    create index if not exists idx_rule_commands_task_id
      on rule_commands(task_id);
  `);
}
