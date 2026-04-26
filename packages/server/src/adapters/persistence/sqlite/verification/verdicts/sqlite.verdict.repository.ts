import { and, count, eq } from "drizzle-orm";
import type { TurnVerdict, VerdictStatus } from "~domain/verification/index.js";
import type {
    IVerdictRepository,
    VerdictUpsertInput,
} from "~application/ports/repository/verdict.repository.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "~adapters/persistence/sqlite/shared/drizzle.db.js";
import { turns, verdicts } from "../sqlite.verification.tables.js";

type VerdictRow = typeof verdicts.$inferSelect;

export class SqliteVerdictRepository implements IVerdictRepository {
    private readonly db: SqliteDatabase;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db);
    }

    async insert(input: VerdictUpsertInput): Promise<TurnVerdict> {
        const values = {
            turnId: input.turnId,
            ruleId: input.ruleId,
            status: input.status,
            matchedPhrase: input.detail.matchedPhrase ?? null,
            expectedPattern: input.detail.expectedPattern ?? null,
            actualToolCallsJson: input.detail.actualToolCalls
                ? JSON.stringify(input.detail.actualToolCalls)
                : null,
            matchedToolCallsJson: input.detail.matchedToolCalls
                ? JSON.stringify(input.detail.matchedToolCalls)
                : null,
            evaluatedAt: input.evaluatedAt,
        };
        this.db.orm
            .insert(verdicts)
            .values(values)
            .onConflictDoUpdate({
                target: [verdicts.turnId, verdicts.ruleId],
                set: {
                    status: values.status,
                    matchedPhrase: values.matchedPhrase,
                    expectedPattern: values.expectedPattern,
                    actualToolCallsJson: values.actualToolCallsJson,
                    matchedToolCallsJson: values.matchedToolCallsJson,
                    evaluatedAt: values.evaluatedAt,
                },
            })
            .run();
        const found = await this.findOne(input.turnId, input.ruleId);
        if (!found) throw new Error(`Verdict (${input.turnId}, ${input.ruleId}) disappeared after upsert`);
        // Carry id from input — the in-memory shape has an id but the DB doesn't (PK is composite)
        return { ...found, id: input.id };
    }

    async findByTurnId(turnId: string): Promise<readonly TurnVerdict[]> {
        const rows = this.db.orm
            .select()
            .from(verdicts)
            .where(eq(verdicts.turnId, turnId))
            .all();
        return rows.map(mapRow);
    }

    async countBySessionAndStatus(sessionId: string, status: VerdictStatus): Promise<number> {
        const row = this.db.orm
            .select({ total: count() })
            .from(verdicts)
            .innerJoin(turns, eq(turns.id, verdicts.turnId))
            .where(and(eq(turns.sessionId, sessionId), eq(verdicts.status, status)))
            .get();
        return row?.total ?? 0;
    }

    async deleteByRuleId(ruleId: string): Promise<void> {
        this.db.orm
            .delete(verdicts)
            .where(eq(verdicts.ruleId, ruleId))
            .run();
    }

    async deleteByTurnId(turnId: string): Promise<void> {
        this.db.orm
            .delete(verdicts)
            .where(eq(verdicts.turnId, turnId))
            .run();
    }

    private async findOne(turnId: string, ruleId: string): Promise<TurnVerdict | null> {
        const row = this.db.orm
            .select()
            .from(verdicts)
            .where(and(eq(verdicts.turnId, turnId), eq(verdicts.ruleId, ruleId)))
            .limit(1)
            .get();
        return row ? mapRow(row) : null;
    }
}

function mapRow(row: VerdictRow): TurnVerdict {
    return {
        // verdicts table uses composite PK; we synthesize an id when present in caller. For findByTurnId
        // we don't have one — use the composite as a stable id.
        id: `${row.turnId}:${row.ruleId}`,
        turnId: row.turnId,
        ruleId: row.ruleId,
        status: row.status as TurnVerdict["status"],
        detail: {
            ...(row.matchedPhrase !== null ? { matchedPhrase: row.matchedPhrase } : {}),
            ...(row.expectedPattern !== null ? { expectedPattern: row.expectedPattern } : {}),
            actualToolCalls: row.actualToolCallsJson
                ? (JSON.parse(row.actualToolCallsJson) as readonly string[])
                : [],
            ...(row.matchedToolCallsJson !== null
                ? { matchedToolCalls: JSON.parse(row.matchedToolCallsJson) as readonly string[] }
                : {}),
        } as TurnVerdict["detail"],
        evaluatedAt: row.evaluatedAt,
    };
}
