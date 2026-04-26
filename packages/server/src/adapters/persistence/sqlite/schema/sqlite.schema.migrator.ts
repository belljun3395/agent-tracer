import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
    addColumnIfMissing(db, "turn_verdicts", "acknowledged", "integer not null default 0");
    addColumnIfMissing(db, "turns_current", "summary_markdown", "text");
    addColumnIfMissing(db, "turns_current", "rules_evaluated_count", "integer not null default 0");
    addColumnIfMissing(db, "rules_current", "trigger_on", "text");
    deleteRejectedRules(db);
    dropIndexIfExists(db, "idx_rules_current_status");
    dropColumnIfExists(db, "rules_current", "status");
}

function addColumnIfMissing(
    db: Database.Database,
    tableName: string,
    columnName: string,
    definition: string,
): void {
    const exists = db
        .prepare<unknown[], { name: string }>(`pragma table_info(${tableName})`)
        .all()
        .some((row) => row.name === columnName);
    if (exists) return;
    db.prepare(`alter table ${tableName} add column ${columnName} ${definition}`).run();
}

function dropColumnIfExists(
    db: Database.Database,
    tableName: string,
    columnName: string,
): void {
    const exists = db
        .prepare<unknown[], { name: string }>(`pragma table_info(${tableName})`)
        .all()
        .some((row) => row.name === columnName);
    if (!exists) return;
    db.prepare(`alter table ${tableName} drop column ${columnName}`).run();
}

function dropIndexIfExists(db: Database.Database, indexName: string): void {
    db.prepare(`drop index if exists ${indexName}`).run();
}

function deleteRejectedRules(db: Database.Database): void {
    const exists = db
        .prepare<unknown[], { name: string }>(`pragma table_info(rules_current)`)
        .all()
        .some((row) => row.name === "status");
    if (!exists) return;
    db.prepare(`delete from rules_current where status = 'rejected'`).run();
}
