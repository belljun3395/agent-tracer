import type Database from "better-sqlite3";
import { createEventLogSchema } from "../events/index.js";
import { backfillCurrentProjections, createProjectionSchema, dropLegacyTaskSessionTables } from "../projections/index.js";
export function runMigrations(db: Database.Database): void {
    createProjectionSchema(db);
    addTimelineEventsLaneColumnIfMissing(db);
    const cols = db.pragma("table_info(monitoring_tasks)") as Array<{
        name: string;
        pk?: number;
    }>;
    let evaluationCols = db.pragma("table_info(evaluations_current)") as Array<{
        name: string;
        pk?: number;
    }>;
    if (cols.length > 0 && !cols.some((c) => c.name === "cli_source")) {
        db.exec("alter table monitoring_tasks add column cli_source text");
    }
    if (cols.length > 0 && !cols.some((c) => c.name === "task_kind")) {
        db.exec("alter table monitoring_tasks add column task_kind text not null default 'primary'");
    }
    if (cols.length > 0 && !cols.some((c) => c.name === "parent_task_id")) {
        db.exec("alter table monitoring_tasks add column parent_task_id text references tasks_current(id) on delete set null");
    }
    if (cols.length > 0 && !cols.some((c) => c.name === "parent_session_id")) {
        db.exec("alter table monitoring_tasks add column parent_session_id text");
    }
    if (cols.length > 0 && !cols.some((c) => c.name === "background_task_id")) {
        db.exec("alter table monitoring_tasks add column background_task_id text");
    }
    if (evaluationCols.length > 0 && needsTaskEvaluationScopeMigration(evaluationCols)) {
        rebuildTaskEvaluationsWithScopes(db, evaluationCols);
        evaluationCols = db.pragma("table_info(evaluations_current)") as Array<{
            name: string;
            pk?: number;
        }>;
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "approach_note")) {
        db.exec("alter table evaluations_current add column approach_note text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "reuse_when")) {
        db.exec("alter table evaluations_current add column reuse_when text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "watchouts")) {
        db.exec("alter table evaluations_current add column watchouts text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "version")) {
        db.exec("alter table evaluations_current add column version integer not null default 1");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "promoted_to")) {
        db.exec("alter table evaluations_current add column promoted_to text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "reuse_count")) {
        db.exec("alter table evaluations_current add column reuse_count integer not null default 0");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "last_reused_at")) {
        db.exec("alter table evaluations_current add column last_reused_at text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "briefing_copy_count")) {
        db.exec("alter table evaluations_current add column briefing_copy_count integer not null default 0");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "workflow_snapshot_json")) {
        db.exec("alter table evaluations_current add column workflow_snapshot_json text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "workflow_context")) {
        db.exec("alter table evaluations_current add column workflow_context text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "search_text")) {
        db.exec("alter table evaluations_current add column search_text text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "embedding")) {
        db.exec("alter table evaluations_current add column embedding text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "embedding_model")) {
        db.exec("alter table evaluations_current add column embedding_model text");
    }
    db.exec(`
      create table if not exists playbooks_current (
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
      )
    `);
    db.exec("create index if not exists idx_playbooks_current_status on playbooks_current(status)");
    db.exec(`
      create table if not exists briefings_current (
        id text primary key,
        task_id text not null references tasks_current(id) on delete cascade,
        generated_at text not null,
        purpose text not null,
        format text not null,
        memo text,
        content text not null
      )
    `);
    db.exec("create index if not exists idx_briefings_current_task_generated on briefings_current(task_id, generated_at desc)");
    db.exec(`
      create table if not exists turn_partitions_current (
        task_id     text primary key references tasks_current(id) on delete cascade,
        groups_json text not null,
        version     integer not null default 1,
        updated_at  text not null
      )
    `);
    createEventLogSchema(db);
    backfillCurrentProjections(db);
    backfillTaskRuntimeSources(db);
    dropLegacyTaskSessionTables(db);
}

function addTimelineEventsLaneColumnIfMissing(db: Database.Database): void {
    const timelineCols = db.pragma("table_info(timeline_events_view)") as Array<{ name: string }>;
    if (timelineCols.length === 0) return; // table not created yet
    if (timelineCols.some((c) => c.name === "lane")) return;
    // Add nullable first, backfill from classification_json, then enforce via application-side writes.
    db.exec("alter table timeline_events_view add column lane text");
    db.exec(`
        update timeline_events_view
        set lane = coalesce(json_extract(classification_json, '$.lane'), 'implementation')
        where lane is null
    `);
}

function needsTaskEvaluationScopeMigration(columns: Array<{ name: string; pk?: number }>): boolean {
    if (!columns.some((column) => column.name === "scope_key")) {
        return true;
    }
    const primaryKeyColumns = columns
        .filter((column) => (column.pk ?? 0) > 0)
        .sort((left, right) => (left.pk ?? 0) - (right.pk ?? 0))
        .map((column) => column.name);
    return primaryKeyColumns.length === 1 && primaryKeyColumns[0] === "task_id";
}

function rebuildTaskEvaluationsWithScopes(db: Database.Database, columns: Array<{ name: string; pk?: number }>): void {
    const hasColumn = (name: string): boolean => columns.some((column) => column.name === name);
    const selectColumn = (name: string, fallback: string): string => hasColumn(name) ? name : fallback;
    db.exec(`
      create table if not exists evaluations_current_v2 (
        task_id text not null references tasks_current(id) on delete cascade,
        scope_key text not null default 'task',
        scope_kind text not null default 'task' check(scope_kind in ('task', 'turn')),
        scope_label text not null default 'Whole task',
        turn_index integer,
        rating text not null check(rating in ('good', 'skip')),
        use_case text,
        workflow_tags text,
        outcome_note text,
        approach_note text,
        reuse_when text,
        watchouts text,
        version integer not null default 1,
        promoted_to text,
        reuse_count integer not null default 0,
        last_reused_at text,
        briefing_copy_count integer not null default 0,
        workflow_snapshot_json text,
        workflow_context text,
        search_text text,
        embedding text,
        embedding_model text,
        evaluated_at text not null,
        primary key (task_id, scope_key)
      );
    `);
    db.exec(`
      insert into evaluations_current_v2 (
        task_id, scope_key, scope_kind, scope_label, turn_index, rating, use_case, workflow_tags,
        outcome_note, approach_note, reuse_when, watchouts, version, promoted_to, reuse_count,
        last_reused_at, briefing_copy_count, workflow_snapshot_json, workflow_context, search_text,
        embedding, embedding_model, evaluated_at
      )
      select
        task_id,
        'task',
        'task',
        'Whole task',
        null,
        rating,
        ${selectColumn("use_case", "null")},
        ${selectColumn("workflow_tags", "null")},
        ${selectColumn("outcome_note", "null")},
        ${selectColumn("approach_note", "null")},
        ${selectColumn("reuse_when", "null")},
        ${selectColumn("watchouts", "null")},
        coalesce(${selectColumn("version", "1")}, 1),
        ${selectColumn("promoted_to", "null")},
        coalesce(${selectColumn("reuse_count", "0")}, 0),
        ${selectColumn("last_reused_at", "null")},
        coalesce(${selectColumn("briefing_copy_count", "0")}, 0),
        ${selectColumn("workflow_snapshot_json", "null")},
        ${selectColumn("workflow_context", "null")},
        ${selectColumn("search_text", "null")},
        ${selectColumn("embedding", "null")},
        ${selectColumn("embedding_model", "null")},
        evaluated_at
      from evaluations_current;
    `);
    db.exec("drop table evaluations_current");
    db.exec("alter table evaluations_current_v2 rename to evaluations_current");
    db.exec("create index if not exists idx_evaluations_current_rating on evaluations_current(rating)");
}

function backfillTaskRuntimeSources(db: Database.Database): void {
    db.exec(`
    update tasks_current
    set cli_source = (
      select b.runtime_source
      from runtime_bindings_current b
      where b.task_id = tasks_current.id
        and coalesce(trim(b.runtime_source), '') <> ''
      order by datetime(b.updated_at) desc, datetime(b.created_at) desc
      limit 1
    )
    where coalesce(trim(cli_source), '') = ''
      and exists (
        select 1
        from runtime_bindings_current b
        where b.task_id = tasks_current.id
          and coalesce(trim(b.runtime_source), '') <> ''
      );
  `);
    db.exec(`
    update tasks_current
    set cli_source = (
      select coalesce(
        json_extract(e.metadata_json, '$.runtimeSource'),
        json_extract(e.metadata_json, '$.source')
      )
      from timeline_events_view e
      where e.task_id = tasks_current.id
        and coalesce(
          json_extract(e.metadata_json, '$.runtimeSource'),
          json_extract(e.metadata_json, '$.source')
        ) is not null
      order by datetime(e.created_at) asc, e.id asc
      limit 1
    )
    where coalesce(trim(cli_source), '') = ''
      and exists (
        select 1
        from timeline_events_view e
        where e.task_id = tasks_current.id
          and coalesce(
            json_extract(e.metadata_json, '$.runtimeSource'),
            json_extract(e.metadata_json, '$.source')
          ) is not null
      );
  `);
}
