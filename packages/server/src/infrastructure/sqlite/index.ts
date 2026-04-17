import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type { INotificationPublisher, MonitorPorts } from "@monitor/application";
import type { IEmbeddingService } from "../embedding";
import { createSqliteDatabase } from "./drizzle-db.js";
import { createSchema } from "./sqlite-schema.js";
import { backfillSearchDocuments } from "./sqlite-search-documents.js";
import { runMigrations } from "./sqlite-schema-migrator.js";
import { SqliteTaskRepository } from "./sqlite-task-repository.js";
import { SqliteSessionRepository } from "./sqlite-session-repository.js";
import { SqliteEventRepository } from "./sqlite-event-repository.js";
import { SqliteRuntimeBindingRepository } from "./sqlite-runtime-binding-repository.js";
import { SqliteBookmarkRepository } from "./sqlite-bookmark-repository.js";
import { SqliteEvaluationRepository } from "./sqlite-evaluation-repository.js";
export { SqliteTaskRepository } from "./sqlite-task-repository.js";
export { SqliteSessionRepository } from "./sqlite-session-repository.js";
export { SqliteEventRepository } from "./sqlite-event-repository.js";
export { SqliteRuntimeBindingRepository } from "./sqlite-runtime-binding-repository.js";
export { SqliteBookmarkRepository } from "./sqlite-bookmark-repository.js";
export { SqliteEvaluationRepository } from "./sqlite-evaluation-repository.js";
export { createSqliteDatabase, ensureSqliteDatabase } from "./drizzle-db.js";
export { drizzleSchema } from "./drizzle-schema.js";
export { createSchema } from "./sqlite-schema.js";
export { runMigrations } from "./sqlite-schema-migrator.js";
export { backfillSearchDocuments } from "./sqlite-search-documents.js";
export interface SqliteMonitorPortsOptions {
    readonly databasePath: string;
    readonly notifier?: INotificationPublisher;
    readonly embeddingService?: IEmbeddingService;
}
export function createSqliteMonitorPorts(options: SqliteMonitorPortsOptions): MonitorPorts & {
    close: () => void;
} {
    fs.mkdirSync(path.dirname(options.databasePath), { recursive: true });
    const client = new BetterSqlite3(options.databasePath);
    client.pragma("journal_mode = WAL");
    client.pragma("case_sensitive_like = OFF");
    createSchema(client);
    runMigrations(client);
    backfillSearchDocuments(client);
    const db = createSqliteDatabase(client);
    const notifier = options.notifier ?? { publish: () => { } };
    return {
        tasks: new SqliteTaskRepository(db),
        sessions: new SqliteSessionRepository(db),
        events: new SqliteEventRepository(db, options.embeddingService),
        runtimeBindings: new SqliteRuntimeBindingRepository(db),
        bookmarks: new SqliteBookmarkRepository(db),
        evaluations: new SqliteEvaluationRepository(db, options.embeddingService),
        notifier,
        close: () => client.close()
    };
}
