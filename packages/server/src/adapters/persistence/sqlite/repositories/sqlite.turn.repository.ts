import type Database from "better-sqlite3";
import type { ITurnRepository, TurnInsertInput, StoredTurn } from "~application/ports/repository/turn.repository.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";

export class SqliteTurnRepository implements ITurnRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async insert(input: TurnInsertInput): Promise<StoredTurn> {
        this.db
            .prepare(`
                insert into turns_current (id, session_id, "index", started_at, ended_at, assistant_text)
                values (@id, @sessionId, @index, @startedAt, @endedAt, @assistantText)
            `)
            .run({
                id: input.id,
                sessionId: input.sessionId,
                index: input.index,
                startedAt: input.startedAt,
                endedAt: input.endedAt,
                assistantText: input.assistantText,
            });
        return { ...input, rulesEvaluatedCount: 0, aggregateVerdict: null };
    }

    async linkEvents(turnId: string, eventIds: readonly string[]): Promise<void> {
        const stmt = this.db.prepare(
            "insert or ignore into turn_event_links (turn_id, event_id) values (@turnId, @eventId)",
        );
        this.db.transaction(() => {
            for (const eventId of eventIds) {
                stmt.run({ turnId, eventId });
            }
        })();
    }

    async countBySessionId(sessionId: string): Promise<number> {
        const row = this.db
            .prepare<{ sessionId: string }, { count: number }>(
                "select count(*) as count from turns_current where session_id = @sessionId",
            )
            .get({ sessionId });
        return row?.count ?? 0;
    }

    async updateAggregateVerdict(
        turnId: string,
        verdict: "verified" | "unverifiable" | "contradicted" | null,
    ): Promise<void> {
        this.db
            .prepare("update turns_current set aggregate_verdict = @verdict where id = @turnId")
            .run({ turnId, verdict });
    }

    async findLatestBySessionId(sessionId: string): Promise<StoredTurn | null> {
        const row = this.db
            .prepare<{ sessionId: string }, {
                id: string;
                session_id: string;
                index: number;
                started_at: string;
                ended_at: string;
                assistant_text: string;
                rules_evaluated_count: number;
                aggregate_verdict: string | null;
            }>(`
                select id, session_id, "index", started_at, ended_at, assistant_text,
                       rules_evaluated_count, aggregate_verdict
                from turns_current
                where session_id = @sessionId
                order by started_at desc
                limit 1
            `)
            .get({ sessionId });
        if (!row) return null;
        return {
            id: row.id,
            sessionId: row.session_id,
            index: row.index,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            assistantText: row.assistant_text,
            rulesEvaluatedCount: row.rules_evaluated_count,
            aggregateVerdict: row.aggregate_verdict,
        };
    }

    async updateAssistantResponse(turnId: string, assistantText: string, endedAt: string): Promise<void> {
        this.db
            .prepare("update turns_current set assistant_text = @assistantText, ended_at = @endedAt where id = @turnId")
            .run({ turnId, assistantText, endedAt });
    }

    async updateRulesEvaluatedCount(turnId: string, count: number): Promise<void> {
        this.db
            .prepare("update turns_current set rules_evaluated_count = @count where id = @turnId")
            .run({ turnId, count });
    }
}
