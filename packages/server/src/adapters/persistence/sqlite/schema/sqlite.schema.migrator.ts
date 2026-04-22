import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
    let evaluationCols = db.pragma("table_info(evaluations_current)") as Array<{
        name: string;
        pk?: number;
    }>;
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
