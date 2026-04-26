import BetterSqlite3 from "better-sqlite3";
import { SqliteEventStore } from "~adapters/persistence/sqlite/events/sqlite.event-store.js";

async function main(): Promise<void> {
    const [databasePath, aggregateId, fromEventId] = process.argv.slice(2);
    if (!databasePath || !aggregateId) {
        process.stderr.write("Usage: tsx packages/server/src/main/replay-events.ts <sqlite-db-path> <aggregate-id> [from-event-id]\n");
        process.exitCode = 1;
        return;
    }

    const db = new BetterSqlite3(databasePath, { readonly: true, fileMustExist: true });
    try {
        const store = new SqliteEventStore(db);
        for await (const event of store.readAggregate(aggregateId, fromEventId)) {
            process.stdout.write(`${JSON.stringify(event)}\n`);
        }
    } finally {
        db.close();
    }
}

void main();
