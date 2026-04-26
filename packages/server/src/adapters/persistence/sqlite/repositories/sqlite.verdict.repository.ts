import type Database from "better-sqlite3";
import type {
    IVerdictRepository,
    VerdictCreateInput,
} from "~application/ports/repository/verdict.repository.js";
import type { TurnVerdict, VerdictStatus } from "~domain/verification/index.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { mapVerdictRow, type VerdictRow } from "./sqlite.verdict.row.type.js";

export class SqliteVerdictRepository implements IVerdictRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async insert(input: VerdictCreateInput): Promise<TurnVerdict> {
        const detailJson = JSON.stringify({
            matchedPhrase: input.detail.matchedPhrase,
            expectedPattern: input.detail.expectedPattern,
            actualToolCalls: input.detail.actualToolCalls ?? [],
            matchedToolCalls: input.detail.matchedToolCalls,
        });
        this.db
            .prepare(`
                insert into turn_verdicts (id, turn_id, rule_id, status, detail_json, evaluated_at)
                values (@id, @turnId, @ruleId, @status, @detailJson, @evaluatedAt)
            `)
            .run({
                id: input.id,
                turnId: input.turnId,
                ruleId: input.ruleId,
                status: input.status,
                detailJson,
                evaluatedAt: input.evaluatedAt,
            });
        const row = this.db
            .prepare<{ id: string }, VerdictRow>(
                "select id, turn_id, rule_id, status, detail_json, evaluated_at from turn_verdicts where id = @id",
            )
            .get({ id: input.id });
        if (!row) {
            throw new Error(`Failed to load verdict ${input.id} immediately after insert`);
        }
        return mapVerdictRow(row);
    }

    async findByTurnId(turnId: string): Promise<readonly TurnVerdict[]> {
        const rows = this.db
            .prepare<{ turnId: string }, VerdictRow>(
                "select id, turn_id, rule_id, status, detail_json, evaluated_at from turn_verdicts where turn_id = @turnId order by evaluated_at asc",
            )
            .all({ turnId });
        return rows.map(mapVerdictRow);
    }

    async countBySessionAndStatus(sessionId: string, status: VerdictStatus): Promise<number> {
        const row = this.db
            .prepare<{ sessionId: string; status: string }, { n: number }>(`
                select count(*) as n
                from turn_verdicts v
                inner join turns_current t on t.id = v.turn_id
                where t.session_id = @sessionId and v.status = @status
            `)
            .get({ sessionId, status });
        return row?.n ?? 0;
    }

    async countUnacknowledgedContradicted(sessionId: string): Promise<number> {
        const row = this.db
            .prepare<{ sessionId: string }, { n: number }>(`
                select count(*) as n
                from turn_verdicts v
                inner join turns_current t on t.id = v.turn_id
                where t.session_id = @sessionId
                  and v.status = 'contradicted'
                  and v.acknowledged = 0
            `)
            .get({ sessionId });
        return row?.n ?? 0;
    }

    async existsByTurnIdAndRuleId(turnId: string, ruleId: string): Promise<boolean> {
        const row = this.db
            .prepare<{ turnId: string; ruleId: string }, { n: number }>(
                "select count(*) as n from turn_verdicts where turn_id = @turnId and rule_id = @ruleId",
            )
            .get({ turnId, ruleId });
        return (row?.n ?? 0) > 0;
    }

    async markAcknowledged(turnId: string): Promise<void> {
        this.db
            .prepare("update turn_verdicts set acknowledged = 1 where turn_id = @turnId")
            .run({ turnId });
    }

    async deleteByTurnId(turnId: string): Promise<void> {
        this.db.prepare("delete from turn_verdicts where turn_id = @turnId").run({ turnId });
    }
}
