import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { createSqliteDatabase, type SqliteDatabase } from "./shared/drizzle.db.js";
import { createSchema } from "./schema/sqlite.schema.js";
import { backfillSearchDocuments } from "./search/sqlite.search.documents.js";
import { runMigrations } from "./schema/sqlite.schema.migrator.js";
export { SqliteTaskRepository } from "./repositories/sqlite.task.repository.js";
export { SqliteSessionRepository } from "./repositories/sqlite.session.repository.js";
export { SqliteEventRepository } from "./repositories/sqlite.event.repository.js";
export { SqliteRuntimeBindingRepository } from "./repositories/sqlite.runtime.binding.repository.js";
export { SqliteBookmarkRepository } from "./repositories/sqlite.bookmark.repository.js";
export { SqliteEvaluationRepository } from "./repositories/sqlite.evaluation.repository.js";
export { SqlitePlaybookRepository } from "./repositories/sqlite.playbook.repository.js";
export { SqliteRuleCommandRepository } from "./repositories/sqlite.rule-command.repository.js";
export { SqliteTurnPartitionRepository } from "./repositories/sqlite.turn.partition.repository.js";
export { SqliteEventStore } from "./events/index.js";
export { createSqliteDatabase, ensureSqliteDatabase } from "./shared/drizzle.db.js";
export { drizzleSchema } from "./schema/drizzle.schema.js";
export { createSchema } from "./schema/sqlite.schema.js";
export { runMigrations } from "./schema/sqlite.schema.migrator.js";
export { backfillSearchDocuments } from "./search/sqlite.search.documents.js";
export { cosineSimilarity, deserializeEmbedding, serializeEmbedding } from "./shared/embedding.codec.js";

export interface SqliteDatabaseContext {
    readonly client: BetterSqlite3.Database;
    readonly db: SqliteDatabase;
    close(): void;
}

export function createSqliteDatabaseContext(databasePath: string): SqliteDatabaseContext {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const client = new BetterSqlite3(databasePath);
    client.pragma("journal_mode = WAL");
    client.pragma("case_sensitive_like = OFF");
    createSchema(client);
    runMigrations(client);
    backfillSearchDocuments(client);
    const db = createSqliteDatabase(client);

    return {
        client,
        db,
        close: () => client.close()
    };
}
