import type Database from "better-sqlite3";
import { createEventLogSchema } from "../events/index.js";
import { createProjectionSchema } from "../projections/index.js";

export function createSchema(db: Database.Database): void {
    db.pragma("foreign_keys = ON");
    createProjectionSchema(db);
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

    create table if not exists rule_enforcements (
      event_id text primary key references timeline_events_view(id) on delete cascade,
      rule_id text,
      policy text,
      outcome text,
      status text,
      decided_at text not null
    );
    create index if not exists idx_rule_enforcements_rule on rule_enforcements(rule_id);
    create index if not exists idx_rule_enforcements_outcome on rule_enforcements(outcome);
    create index if not exists idx_rule_enforcements_status on rule_enforcements(status);

    create table if not exists verification_outcomes (
      event_id text primary key references timeline_events_view(id) on delete cascade,
      rule_id text,
      status text,
      checked_at text not null
    );
    create index if not exists idx_verification_outcomes_status on verification_outcomes(status);

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

    create table if not exists runtime_bindings_current (
      runtime_source text not null,
      runtime_session_id text not null,
      task_id text not null references tasks_current(id) on delete cascade,
      monitor_session_id text references sessions_current(id) on delete set null,
      created_at text not null,
      updated_at text not null,
      primary key (runtime_source, runtime_session_id)
    );

    create table if not exists search_documents (
      scope text not null check(scope in ('task', 'event', 'evaluation')),
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

    create table if not exists evaluations_core (
      task_id text not null references tasks_current(id) on delete cascade,
      scope_key text not null default 'task',
      scope_kind text not null check(scope_kind in ('task','turn')),
      scope_label text not null,
      turn_index integer,
      rating text not null check(rating in ('good','skip')),
      version integer not null default 1,
      evaluated_at text not null,
      primary key (task_id, scope_key)
    );
    create index if not exists idx_evaluations_core_rating on evaluations_core(rating);

    create table if not exists evaluation_contents (
      task_id text not null,
      scope_key text not null,
      use_case text,
      workflow_tags_json text,
      outcome_note text,
      approach_note text,
      reuse_when text,
      watchouts text,
      workflow_snapshot_json text,
      workflow_context text,
      primary key (task_id, scope_key),
      foreign key (task_id, scope_key) references evaluations_core(task_id, scope_key) on delete cascade
    );

    create table if not exists evaluation_reuse_stats (
      task_id text not null,
      scope_key text not null,
      reuse_count integer not null default 0,
      last_reused_at text,
      primary key (task_id, scope_key),
      foreign key (task_id, scope_key) references evaluations_core(task_id, scope_key) on delete cascade
    );

    create table if not exists turn_partitions_current (
      task_id text primary key references tasks_current(id) on delete cascade,
      groups_json text not null,
      version integer not null default 1,
      updated_at text not null
    );

    create table if not exists rules_current (
      id text primary key,
      name text not null,
      trigger_phrases_json text,
      trigger_on text check(trigger_on is null or trigger_on in ('assistant','user')),
      expect_tool text,
      expect_command_matches_json text,
      expect_pattern text,
      scope text not null check(scope in ('global','task')),
      task_id text references tasks_current(id) on delete cascade,
      source text not null check(source in ('human','agent')),
      severity text not null check(severity in ('info','warn','block')),
      rationale text,
      created_at text not null,
      check ((scope = 'task' and task_id is not null) or (scope = 'global' and task_id is null))
    );
    create index if not exists idx_rules_current_scope_task on rules_current(scope, task_id);

    create table if not exists app_config (
      key text primary key,
      value_json text not null,
      updated_at text not null
    );

    create table if not exists turns_current (
      id text primary key,
      session_id text not null references sessions_current(id) on delete cascade,
      "index" integer not null,
      started_at text not null,
      ended_at text not null,
      assistant_text text not null,
      summary_markdown text,
      rules_evaluated_count integer not null default 0,
      aggregate_verdict text
        check(aggregate_verdict is null
              or aggregate_verdict in ('verified','unverifiable','contradicted'))
    );
    create index if not exists idx_turns_current_session_index
      on turns_current(session_id, "index");
    create index if not exists idx_turns_current_session_started
      on turns_current(session_id, started_at desc);

    create table if not exists turn_event_links (
      turn_id text not null references turns_current(id) on delete cascade,
      event_id text not null references timeline_events_view(id) on delete cascade,
      primary key (turn_id, event_id)
    );
    create index if not exists idx_turn_event_links_event on turn_event_links(event_id);

    create table if not exists turn_verdicts (
      id text primary key,
      turn_id text not null references turns_current(id) on delete cascade,
      rule_id text not null,
      status text not null check(status in ('verified','unverifiable','contradicted')),
      detail_json text not null default '{}',
      acknowledged integer not null default 0,
      evaluated_at text not null
    );
    create index if not exists idx_turn_verdicts_turn on turn_verdicts(turn_id);
    create index if not exists idx_turn_verdicts_rule on turn_verdicts(rule_id);
  `);
    createEventLogSchema(db);
}
