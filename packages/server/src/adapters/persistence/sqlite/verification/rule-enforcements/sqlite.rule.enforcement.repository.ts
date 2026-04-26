import { eq, inArray } from "drizzle-orm";
import type {
    IRuleEnforcementRepository,
    RuleEnforcementInsert,
    RuleEnforcementRow,
} from "~application/ports/repository/rule.enforcement.repository.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "~adapters/persistence/sqlite/shared/drizzle.db.js";
import { ruleEnforcements } from "../sqlite.verification.tables.js";

type Row = typeof ruleEnforcements.$inferSelect;

export class SqliteRuleEnforcementRepository implements IRuleEnforcementRepository {
    private readonly db: SqliteDatabase;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db);
    }

    async insert(row: RuleEnforcementInsert): Promise<RuleEnforcementRow | null> {
        const result = this.db.orm
            .insert(ruleEnforcements)
            .values(row)
            .onConflictDoNothing()
            .run();
        return result.changes > 0 ? row : null;
    }

    async insertMany(rows: readonly RuleEnforcementInsert[]): Promise<readonly RuleEnforcementRow[]> {
        if (rows.length === 0) return [];
        return this.db.orm.transaction((tx) => {
            const inserted: RuleEnforcementRow[] = [];
            for (const r of rows) {
                const result = tx
                    .insert(ruleEnforcements)
                    .values(r)
                    .onConflictDoNothing()
                    .run();
                if (result.changes > 0) inserted.push(r);
            }
            return inserted;
        });
    }

    async findByEventId(eventId: string): Promise<readonly RuleEnforcementRow[]> {
        const rows = this.db.orm
            .select()
            .from(ruleEnforcements)
            .where(eq(ruleEnforcements.eventId, eventId))
            .all();
        return rows.map(mapRow);
    }

    async findByEventIds(eventIds: readonly string[]): Promise<readonly RuleEnforcementRow[]> {
        if (eventIds.length === 0) return [];
        const rows = this.db.orm
            .select()
            .from(ruleEnforcements)
            .where(inArray(ruleEnforcements.eventId, eventIds))
            .all();
        return rows.map(mapRow);
    }

    async deleteByRuleId(ruleId: string): Promise<void> {
        this.db.orm
            .delete(ruleEnforcements)
            .where(eq(ruleEnforcements.ruleId, ruleId))
            .run();
    }

    async eventIdToRuleIds(eventIds: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
        const map = new Map<string, Set<string>>();
        if (eventIds.length === 0) return map;
        const rows = await this.findByEventIds(eventIds);
        for (const r of rows) {
            let s = map.get(r.eventId);
            if (!s) {
                s = new Set();
                map.set(r.eventId, s);
            }
            s.add(r.ruleId);
        }
        return map;
    }
}

function mapRow(row: Row): RuleEnforcementRow {
    const matchKind = row.matchKind === "trigger" ? "trigger" : "expect-fulfilled";
    return {
        eventId: row.eventId,
        ruleId: row.ruleId,
        matchKind,
        decidedAt: row.decidedAt,
    };
}
