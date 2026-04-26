import type Database from "better-sqlite3";

export function createTimelineEventSchema(db: Database.Database): void {
    db.exec(`
      create table if not exists timeline_events_view (
        id text primary key,
        task_id text not null references tasks_current(id) on delete cascade,
        session_id text references sessions_current(id) on delete set null,
        kind text not null,
        lane text not null,
        title text not null,
        body text,
        subtype_key text,
        subtype_label text,
        subtype_group text,
        tool_family text,
        operation text,
        source_tool text,
        tool_name text,
        entity_type text,
        entity_name text,
        display_title text,
        evidence_level text,
        extras_json text not null default '{}',
        created_at text not null
      );

      create index if not exists idx_timeline_events_view_task_created
        on timeline_events_view(task_id, created_at);
      create index if not exists idx_timeline_events_subtype_group
        on timeline_events_view(subtype_group, created_at);
      create index if not exists idx_timeline_events_tool_family
        on timeline_events_view(tool_family);
      create index if not exists idx_timeline_events_lane_created
        on timeline_events_view(lane, created_at);

      create table if not exists event_files (
        event_id text not null references timeline_events_view(id) on delete cascade,
        file_path text not null,
        source text not null default 'metadata' check(source in ('metadata','command_analysis','runtime_relpath','multiple')),
        write_count integer not null default 0,
        primary key (event_id, file_path)
      );
      create index if not exists idx_event_files_path on event_files(file_path);
      create index if not exists idx_event_files_event on event_files(event_id);

      create table if not exists event_relations (
        event_id text not null references timeline_events_view(id) on delete cascade,
        source_event_id text not null,
        target_event_id text not null,
        edge_kind text not null check(edge_kind in ('parent','source','related')),
        relation_type text not null default 'relates_to'
          check(relation_type in ('implements','revises','verifies','answers','delegates','returns','completes','blocks','caused_by','relates_to')),
        relation_label text,
        relation_explanation text,
        primary key (event_id, source_event_id, target_event_id, edge_kind, relation_type)
      );
      create index if not exists idx_event_relations_source on event_relations(source_event_id);
      create index if not exists idx_event_relations_target on event_relations(target_event_id);

      create table if not exists event_async_refs (
        event_id text primary key references timeline_events_view(id) on delete cascade,
        async_task_id text not null,
        async_status text,
        async_agent text,
        async_category text,
        duration_ms integer
      );
      create index if not exists idx_event_async_refs_task on event_async_refs(async_task_id);

      create table if not exists event_tags (
        event_id text not null references timeline_events_view(id) on delete cascade,
        tag text not null,
        source text not null default 'metadata' check(source in ('metadata','classification','multiple')),
        primary key (event_id, tag)
      );
      create index if not exists idx_event_tags_tag on event_tags(tag);

      create table if not exists todos_current (
        id text primary key,
        task_id text not null references tasks_current(id) on delete cascade,
        title text not null,
        state text not null check(state in ('added','in_progress','completed','cancelled')),
        priority text,
        auto_reconciled integer not null default 0,
        last_event_id text references timeline_events_view(id) on delete set null,
        created_at text not null,
        updated_at text not null
      );
      create index if not exists idx_todos_task_state on todos_current(task_id, state);

      create table if not exists questions_current (
        id text primary key,
        task_id text not null references tasks_current(id) on delete cascade,
        title text not null,
        phase text not null check(phase in ('asked','answered','concluded')),
        sequence integer,
        model_name text,
        model_provider text,
        last_event_id text references timeline_events_view(id) on delete set null,
        created_at text not null,
        updated_at text not null
      );
      create index if not exists idx_questions_task_phase on questions_current(task_id, phase);

      create table if not exists event_token_usage (
        event_id text primary key references timeline_events_view(id) on delete cascade,
        session_id text references sessions_current(id) on delete set null,
        task_id text not null references tasks_current(id) on delete cascade,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        cache_read_tokens integer not null default 0,
        cache_create_tokens integer not null default 0,
        cost_usd real,
        duration_ms integer,
        model text,
        prompt_id text,
        stop_reason text,
        occurred_at text not null
      );
      create index if not exists idx_event_token_usage_session on event_token_usage(session_id, occurred_at);
      create index if not exists idx_event_token_usage_model on event_token_usage(model);
      create index if not exists idx_event_token_usage_task on event_token_usage(task_id, occurred_at);
    `);
}
