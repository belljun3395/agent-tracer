import type Database from "better-sqlite3";
import type {
    ITurnRepository,
    StoredTurn,
    TurnInsertInput,
} from "~application/ports/repository/turn.repository.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "~adapters/persistence/sqlite/shared/drizzle.db.js";

interface TurnRow {
    readonly id: string;
    readonly session_id: string;
    readonly task_id: string;
    readonly turn_index: number;
    readonly status: string;
    readonly started_at: string;
    readonly ended_at: string | null;
    readonly asked_text: string | null;
    readonly assistant_text: string | null;
    readonly aggregate_verdict: string | null;
    readonly rules_evaluated_count: number;
}

const SELECT_COLUMNS = `id, session_id, task_id, turn_index, status, started_at,
    ended_at, asked_text, assistant_text, aggregate_verdict, rules_evaluated_count`;

export class SqliteTurnRepository implements ITurnRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async insert(input: TurnInsertInput): Promise<StoredTurn> {
        this.db
            .prepare(
                `insert into turns (
                    id, session_id, task_id, turn_index, status, started_at,
                    ended_at, asked_text, assistant_text, aggregate_verdict,
                    rules_evaluated_count
                ) values (
                    @id, @sessionId, @taskId, @turnIndex, @status, @startedAt,
                    null, @askedText, null, null, 0
                )`,
            )
            .run({
                id: input.id,
                sessionId: input.sessionId,
                taskId: input.taskId,
                turnIndex: input.turnIndex,
                status: input.status,
                startedAt: input.startedAt,
                askedText: input.askedText ?? null,
            });
        const found = await this.findById(input.id);
        if (!found) throw new Error(`Turn ${input.id} disappeared after insert`);
        return found;
    }

    async linkEvents(turnId: string, eventIds: readonly string[]): Promise<void> {
        if (eventIds.length === 0) return;
        const stmt = this.db.prepare(
            `insert or ignore into turn_events (turn_id, event_id) values (@turnId, @eventId)`,
        );
        const tx = this.db.transaction((ids: readonly string[]) => {
            for (const eventId of ids) stmt.run({ turnId, eventId });
        });
        tx(eventIds);
    }

    async findById(turnId: string): Promise<StoredTurn | null> {
        const row = this.db
            .prepare<{ turnId: string }, TurnRow>(
                `select ${SELECT_COLUMNS} from turns where id = @turnId`,
            )
            .get({ turnId });
        return row ? mapRow(row) : null;
    }

    async findOpenBySessionId(sessionId: string): Promise<StoredTurn | null> {
        const row = this.db
            .prepare<{ sessionId: string }, TurnRow>(
                `select ${SELECT_COLUMNS} from turns
                 where session_id = @sessionId and status = 'open'
                 order by turn_index desc limit 1`,
            )
            .get({ sessionId });
        return row ? mapRow(row) : null;
    }

    async countBySessionId(sessionId: string): Promise<number> {
        const row = this.db
            .prepare<{ sessionId: string }, { count: number }>(
                `select count(*) as count from turns where session_id = @sessionId`,
            )
            .get({ sessionId });
        return row?.count ?? 0;
    }

    async findEventsForTurn(turnId: string): Promise<readonly string[]> {
        const rows = this.db
            .prepare<{ turnId: string }, { event_id: string }>(
                `select te.event_id
                 from turn_events te
                 join timeline_events_view e on e.id = te.event_id
                 where te.turn_id = @turnId
                 order by e.created_at asc`,
            )
            .all({ turnId });
        return rows.map((r) => r.event_id);
    }

    async closeTurn(turnId: string, assistantText: string, endedAt: string): Promise<void> {
        this.db
            .prepare(
                `update turns
                 set status = 'closed', assistant_text = @assistantText, ended_at = @endedAt
                 where id = @turnId`,
            )
            .run({ turnId, assistantText, endedAt });
    }

    async forceCloseTurn(turnId: string, endedAt: string): Promise<void> {
        this.db
            .prepare(
                `update turns
                 set status = 'closed', ended_at = @endedAt
                 where id = @turnId and status = 'open'`,
            )
            .run({ turnId, endedAt });
    }

    async updateAggregateVerdict(turnId: string, verdict: "verified" | "unverifiable" | "contradicted" | null): Promise<void> {
        this.db
            .prepare(
                `update turns set aggregate_verdict = @verdict where id = @turnId`,
            )
            .run({ turnId, verdict });
    }

    async updateRulesEvaluatedCount(turnId: string, count: number): Promise<void> {
        this.db
            .prepare(
                `update turns set rules_evaluated_count = @count where id = @turnId`,
            )
            .run({ turnId, count });
    }
}

function mapRow(row: TurnRow): StoredTurn {
    const status = row.status === "open" ? "open" : "closed";
    const verdict = row.aggregate_verdict;
    const aggregate =
        verdict === "verified" || verdict === "contradicted" || verdict === "unverifiable"
            ? verdict
            : null;
    return {
        id: row.id,
        sessionId: row.session_id,
        taskId: row.task_id,
        turnIndex: row.turn_index,
        status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        askedText: row.asked_text,
        assistantText: row.assistant_text,
        aggregateVerdict: aggregate,
        rulesEvaluatedCount: row.rules_evaluated_count,
    };
}
