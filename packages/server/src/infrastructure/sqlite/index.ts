/**
 * @module infrastructure/sqlite
 *
 * SQLite 저장소 구현 모음 및 MonitorPorts 팩토리.
 */

import fs from "node:fs";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";

import type { INotificationPublisher, MonitorPorts } from "../../application/ports/index.js";
import { createSchema } from "./sqlite-schema.js";
import { runMigrations } from "./sqlite-schema-migrator.js";
import { SqliteTaskRepository } from "./sqlite-task-repository.js";
import { SqliteSessionRepository } from "./sqlite-session-repository.js";
import { SqliteEventRepository } from "./sqlite-event-repository.js";
import { SqliteRuntimeBindingRepository } from "./sqlite-runtime-binding-repository.js";
import { SqliteBookmarkRepository } from "./sqlite-bookmark-repository.js";

export { SqliteTaskRepository } from "./sqlite-task-repository.js";
export { SqliteSessionRepository } from "./sqlite-session-repository.js";
export { SqliteEventRepository } from "./sqlite-event-repository.js";
export { SqliteRuntimeBindingRepository } from "./sqlite-runtime-binding-repository.js";
export { SqliteBookmarkRepository } from "./sqlite-bookmark-repository.js";

export interface SqliteMonitorPortsOptions {
  readonly databasePath: string;
  /** Optional pre-built notifier for real-time notifications. */
  readonly notifier?: INotificationPublisher;
}

/**
 * MonitorPorts를 SQLite 구현으로 조합한다.
 * notifier가 없으면 no-op notifier를 사용한다.
 */
export function createSqliteMonitorPorts(options: SqliteMonitorPortsOptions): MonitorPorts & { close: () => void } {
  fs.mkdirSync(path.dirname(options.databasePath), { recursive: true });
  const db = new BetterSqlite3(options.databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("case_sensitive_like = OFF");

  createSchema(db);
  runMigrations(db);

  const notifier = options.notifier ?? { publish: () => {} };

  return {
    tasks: new SqliteTaskRepository(db),
    sessions: new SqliteSessionRepository(db),
    events: new SqliteEventRepository(db),
    runtimeBindings: new SqliteRuntimeBindingRepository(db),
    bookmarks: new SqliteBookmarkRepository(db),
    notifier,
    close: () => db.close()
  };
}
