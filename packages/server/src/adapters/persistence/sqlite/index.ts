import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type { IEmbeddingService, INotificationPublisher, MonitorPorts } from "~application/index.js";
import { createSqliteDatabase } from "./shared/drizzle.db.js";
import { createSchema } from "./schema/sqlite.schema.js";
import { backfillSearchDocuments } from "./search/sqlite.search.documents.js";
import { runMigrations } from "./schema/sqlite.schema.migrator.js";
import { SqliteTaskRepository } from "./repositories/sqlite.task.repository.js";
import { SqliteSessionRepository } from "./repositories/sqlite.session.repository.js";
import { SqliteEventRepository } from "./repositories/sqlite.event.repository.js";
import { SqliteRuntimeBindingRepository } from "./repositories/sqlite.runtime.binding.repository.js";
import { SqliteBookmarkRepository } from "./repositories/sqlite.bookmark.repository.js";
import { SqliteEvaluationRepository } from "./repositories/sqlite.evaluation.repository.js";
import { SqlitePlaybookRepository } from "./repositories/sqlite.playbook.repository.js";
import { SqliteRuleCommandRepository } from "./repositories/sqlite.rule-command.repository.js";
import { SqliteEventStore } from "./events/index.js";
export { SqliteTaskRepository } from "./repositories/sqlite.task.repository.js";
export { SqliteSessionRepository } from "./repositories/sqlite.session.repository.js";
export { SqliteEventRepository } from "./repositories/sqlite.event.repository.js";
export { SqliteRuntimeBindingRepository } from "./repositories/sqlite.runtime.binding.repository.js";
export { SqliteBookmarkRepository } from "./repositories/sqlite.bookmark.repository.js";
export { SqliteEvaluationRepository } from "./repositories/sqlite.evaluation.repository.js";
export { SqlitePlaybookRepository } from "./repositories/sqlite.playbook.repository.js";
export { SqliteRuleCommandRepository } from "./repositories/sqlite.rule-command.repository.js";
export { SqliteEventStore } from "./events/index.js";
export { createSqliteDatabase, ensureSqliteDatabase } from "./shared/drizzle.db.js";
export { drizzleSchema } from "./schema/drizzle.schema.js";
export { createSchema } from "./schema/sqlite.schema.js";
export { runMigrations } from "./schema/sqlite.schema.migrator.js";
export { backfillSearchDocuments } from "./search/sqlite.search.documents.js";
export { cosineSimilarity, deserializeEmbedding, serializeEmbedding } from "./shared/embedding.codec.js";
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
        eventStore: new SqliteEventStore(client),
        runtimeBindings: new SqliteRuntimeBindingRepository(db),
        bookmarks: new SqliteBookmarkRepository(db),
        evaluations: new SqliteEvaluationRepository(db, options.embeddingService),
        playbooks: new SqlitePlaybookRepository(db, options.embeddingService),
        ruleCommands: new SqliteRuleCommandRepository(db),
        notifier,
        close: () => client.close()
    };
}
