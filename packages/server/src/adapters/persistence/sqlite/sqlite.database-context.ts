import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { createTaskSchema } from "~task/repository/task.schema.js";
import { createSessionSchema } from "~session/repository/session.schema.js";
import { createEventSchema } from "~event/repository/event.schema.js";
import { backfillSearchDocuments } from "~event/repository/search/search.documents.js";
import { createRuleSchema } from "~rule/repository/rule.schema.js";
import { createVerificationSchema } from "~verification/repository/verification.schema.js";
import { createTurnPartitionSchema } from "~turn-partition/domain/turn.partition.schema.js";

/**
 * Bootstrap context for the shared SQLite database.
 *
 * Schema responsibility: each module exports its own DDL helper. The platform
 * orchestrates them in dependency order (FK references determine the order).
 * No drizzle, no per-module-table aggregation file — everything lives in the
 * owning module's `repository/` layer.
 */
export interface SqliteDatabaseContext {
    readonly client: BetterSqlite3.Database;
    close(): void;
}

export function createSqliteDatabaseContext(databasePath: string): SqliteDatabaseContext {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const client = new BetterSqlite3(databasePath);
    client.pragma("foreign_keys = ON");
    client.pragma("journal_mode = WAL");
    client.pragma("case_sensitive_like = OFF");

    // FK-ordered DDL: tasks → sessions → events → rule → verification → turn-partition
    createTaskSchema(client);
    createSessionSchema(client);
    createEventSchema(client);
    createRuleSchema(client);
    createVerificationSchema(client);
    createTurnPartitionSchema(client);

    backfillSearchDocuments(client);

    return {
        client,
        close: () => client.close(),
    };
}
