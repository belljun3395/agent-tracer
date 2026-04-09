import type Database from "better-sqlite3";
export function runMigrations(db: Database.Database): void {
    const cols = db.pragma("table_info(monitoring_tasks)") as Array<{
        name: string;
    }>;
    const evaluationCols = db.pragma("table_info(task_evaluations)") as Array<{
        name: string;
    }>;
    if (!cols.some((c) => c.name === "cli_source")) {
        db.exec("alter table monitoring_tasks add column cli_source text");
    }
    if (!cols.some((c) => c.name === "task_kind")) {
        db.exec("alter table monitoring_tasks add column task_kind text not null default 'primary'");
    }
    if (!cols.some((c) => c.name === "parent_task_id")) {
        db.exec("alter table monitoring_tasks add column parent_task_id text references monitoring_tasks(id) on delete set null");
    }
    if (!cols.some((c) => c.name === "parent_session_id")) {
        db.exec("alter table monitoring_tasks add column parent_session_id text");
    }
    if (!cols.some((c) => c.name === "background_task_id")) {
        db.exec("alter table monitoring_tasks add column background_task_id text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "approach_note")) {
        db.exec("alter table task_evaluations add column approach_note text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "reuse_when")) {
        db.exec("alter table task_evaluations add column reuse_when text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "watchouts")) {
        db.exec("alter table task_evaluations add column watchouts text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "workflow_snapshot_json")) {
        db.exec("alter table task_evaluations add column workflow_snapshot_json text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "workflow_context")) {
        db.exec("alter table task_evaluations add column workflow_context text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "search_text")) {
        db.exec("alter table task_evaluations add column search_text text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "embedding")) {
        db.exec("alter table task_evaluations add column embedding text");
    }
    if (evaluationCols.length > 0 && !evaluationCols.some((c) => c.name === "embedding_model")) {
        db.exec("alter table task_evaluations add column embedding_model text");
    }
    backfillTaskRuntimeSources(db);
}
function backfillTaskRuntimeSources(db: Database.Database): void {
    db.exec(`
    update monitoring_tasks
    set cli_source = (
      select b.runtime_source
      from runtime_session_bindings b
      where b.task_id = monitoring_tasks.id
        and coalesce(trim(b.runtime_source), '') <> ''
      order by datetime(b.updated_at) desc, datetime(b.created_at) desc
      limit 1
    )
    where coalesce(trim(cli_source), '') = ''
      and exists (
        select 1
        from runtime_session_bindings b
        where b.task_id = monitoring_tasks.id
          and coalesce(trim(b.runtime_source), '') <> ''
      );
  `);
    db.exec(`
    update monitoring_tasks
    set cli_source = (
      select coalesce(
        json_extract(e.metadata_json, '$.runtimeSource'),
        json_extract(e.metadata_json, '$.source')
      )
      from timeline_events e
      where e.task_id = monitoring_tasks.id
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
        from timeline_events e
        where e.task_id = monitoring_tasks.id
          and coalesce(
            json_extract(e.metadata_json, '$.runtimeSource'),
            json_extract(e.metadata_json, '$.source')
          ) is not null
      );
  `);
}
