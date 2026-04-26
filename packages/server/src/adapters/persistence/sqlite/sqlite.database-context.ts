import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { createSqliteDatabase, type SqliteDatabase } from "./shared/drizzle.db.js";
import { createSchema } from "./schema/sqlite.schema.js";
import { backfillSearchDocuments } from "./search/sqlite.search.documents.js";
import { runMigrations } from "./schema/sqlite.schema.migrator.js";

export interface SqliteDatabaseContext {
    readonly client: BetterSqlite3.Database;
    readonly db: SqliteDatabase;
    close(): void;
}

export function createSqliteDatabaseContext(databasePath: string): SqliteDatabaseContext {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const client = new BetterSqlite3(databasePath);
    client.pragma("foreign_keys = ON");
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
