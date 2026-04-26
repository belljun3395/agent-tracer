import type Database from "better-sqlite3";
import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";

interface AppConfigRow {
    readonly key: string;
    readonly value_json: string;
    readonly updated_at: string;
}

export class SqliteAppConfigRepository implements IAppConfigRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async get(key: string): Promise<unknown> {
        const row = this.db
            .prepare<{ key: string }, AppConfigRow>(
                "select key, value_json, updated_at from app_config where key = @key",
            )
            .get({ key });
        if (!row) return null;
        return JSON.parse(row.value_json);
    }

    async getAll(): Promise<Record<string, unknown>> {
        const rows = this.db
            .prepare<unknown[], AppConfigRow>(
                "select key, value_json, updated_at from app_config",
            )
            .all();
        const out: Record<string, unknown> = {};
        for (const row of rows) {
            out[row.key] = JSON.parse(row.value_json);
        }
        return out;
    }

    async setMany(updates: Record<string, unknown>): Promise<void> {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            insert into app_config (key, value_json, updated_at)
            values (@key, @valueJson, @updatedAt)
            on conflict(key) do update set
              value_json = excluded.value_json,
              updated_at = excluded.updated_at
        `);
        this.db.transaction(() => {
            for (const [key, value] of Object.entries(updates)) {
                stmt.run({
                    key,
                    valueJson: JSON.stringify(value),
                    updatedAt: now,
                });
            }
        })();
    }

    async delete(key: string): Promise<boolean> {
        const result = this.db
            .prepare("delete from app_config where key = @key")
            .run({ key });
        return result.changes > 0;
    }
}
