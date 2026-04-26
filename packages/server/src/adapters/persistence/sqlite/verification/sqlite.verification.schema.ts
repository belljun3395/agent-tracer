import type Database from "better-sqlite3";

export function createVerificationSchema(db: Database.Database): void {
    db.exec(`
      -- Verification rules: trigger + expect contract evaluated against turns.
      create table if not exists rules (
        id text primary key,
        name text not null,
        trigger_phrases_json text,
        trigger_on text check(trigger_on in ('user','assistant')),
        expect_tool text,
        expect_command_matches_json text,
        expect_pattern text,
        scope text not null check(scope in ('global','task')),
        task_id text references tasks_current(id) on delete cascade,
        source text not null check(source in ('human','agent')),
        severity text not null check(severity in ('info','warn','block')),
        rationale text,
        signature text not null,
        created_at text not null,
        deleted_at text,
        check (
          (scope = 'global' and task_id is null)
          or (scope = 'task' and task_id is not null)
        )
      );
      create index if not exists idx_rules_scope_active on rules(scope) where deleted_at is null;
      create index if not exists idx_rules_task_active on rules(task_id) where deleted_at is null;
      create index if not exists idx_rules_signature on rules(signature);

      -- Turns: (user.message -> assistant.response) cycles per session.
      create table if not exists turns (
        id text primary key,
        session_id text not null references sessions_current(id) on delete cascade,
        task_id text not null references tasks_current(id) on delete cascade,
        turn_index integer not null,
        status text not null check(status in ('open','closed')),
        started_at text not null,
        ended_at text,
        asked_text text,
        assistant_text text,
        aggregate_verdict text check(aggregate_verdict in ('verified','contradicted','unverifiable')),
        rules_evaluated_count integer not null default 0
      );
      create unique index if not exists idx_turns_session_index on turns(session_id, turn_index);
      create index if not exists idx_turns_task_started on turns(task_id, started_at);
      create index if not exists idx_turns_session_open on turns(session_id) where status = 'open';

      create table if not exists turn_events (
        turn_id text not null references turns(id) on delete cascade,
        event_id text not null references timeline_events_view(id) on delete cascade,
        primary key (turn_id, event_id)
      );
      create index if not exists idx_turn_events_event on turn_events(event_id);

      create table if not exists verdicts (
        turn_id text not null references turns(id) on delete cascade,
        rule_id text not null references rules(id) on delete cascade,
        status text not null check(status in ('verified','contradicted','unverifiable')),
        matched_phrase text,
        expected_pattern text,
        actual_tool_calls_json text,
        matched_tool_calls_json text,
        evaluated_at text not null,
        primary key (turn_id, rule_id)
      );
      create index if not exists idx_verdicts_rule on verdicts(rule_id);
      create index if not exists idx_verdicts_status on verdicts(status);

      create table if not exists rule_enforcements (
        event_id text not null references timeline_events_view(id) on delete cascade,
        rule_id text not null references rules(id) on delete cascade,
        match_kind text not null check(match_kind in ('trigger','expect-fulfilled')),
        decided_at text not null,
        primary key (event_id, rule_id, match_kind)
      );
      create index if not exists idx_rule_enforcements_rule on rule_enforcements(rule_id);
      create index if not exists idx_rule_enforcements_event on rule_enforcements(event_id);
    `);
}
