/**
 * @module infrastructure/sqlite/sqlite-schema-migrator
 *
 * 점진적 마이그레이션: 기존 DB에 누락된 컬럼을 추가한다.
 */

import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  const cols = db.pragma("table_info(monitoring_tasks)") as Array<{ name: string }>;

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
}
