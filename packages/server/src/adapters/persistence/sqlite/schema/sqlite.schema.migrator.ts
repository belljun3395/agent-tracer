import type Database from "better-sqlite3";

export function runMigrations(_db: Database.Database): void {
    // No legacy SQLite migrations are kept before first deployment.
}
