import { asc, eq } from "drizzle-orm";
import type {
    BackfillTurnRow,
    ITurnQueryRepository,
    TaskTurnSummaryRow,
} from "~application/ports/repository/turn.query.repository.js";
import type { VerdictStatus } from "~domain/verification/index.js";
import { turns, verdicts } from "../schema/drizzle.schema.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";

export class SqliteTurnQueryRepository implements ITurnQueryRepository {
    private readonly db: SqliteDatabase;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db);
    }

    async listAllTurnsForBackfill(): Promise<ReadonlyArray<BackfillTurnRow>> {
        const rows = this.db.orm
            .select({
                id: turns.id,
                sessionId: turns.sessionId,
                taskId: turns.taskId,
                status: turns.status,
                assistantText: turns.assistantText,
                askedText: turns.askedText,
            })
            .from(turns)
            .all();
        return rows.map(mapBackfillTurn);
    }

    async listTurnsForTaskBackfill(taskId: string): Promise<ReadonlyArray<BackfillTurnRow>> {
        const rows = this.db.orm
            .select({
                id: turns.id,
                sessionId: turns.sessionId,
                taskId: turns.taskId,
                status: turns.status,
                assistantText: turns.assistantText,
                askedText: turns.askedText,
            })
            .from(turns)
            .where(eq(turns.taskId, taskId))
            .all();
        return rows.map(mapBackfillTurn);
    }

    async listVerdictStatusesForTask(taskId: string): Promise<readonly VerdictStatus[]> {
        const rows = this.db.orm
            .select({ status: verdicts.status })
            .from(verdicts)
            .innerJoin(turns, eq(turns.id, verdicts.turnId))
            .where(eq(turns.taskId, taskId))
            .all();
        return rows.map((row) => row.status as VerdictStatus);
    }

    async listTurnSummariesForTask(taskId: string): Promise<ReadonlyArray<TaskTurnSummaryRow>> {
        const rows = this.db.orm
            .select({
                id: turns.id,
                sessionId: turns.sessionId,
                taskId: turns.taskId,
                turnIndex: turns.turnIndex,
                status: turns.status,
                startedAt: turns.startedAt,
                endedAt: turns.endedAt,
                aggregateVerdict: turns.aggregateVerdict,
                rulesEvaluatedCount: turns.rulesEvaluatedCount,
            })
            .from(turns)
            .where(eq(turns.taskId, taskId))
            .orderBy(asc(turns.startedAt), asc(turns.turnIndex))
            .all();
        return rows.map((row) => ({
            id: row.id,
            sessionId: row.sessionId,
            taskId: row.taskId,
            turnIndex: row.turnIndex,
            status: row.status === "open" ? "open" : "closed",
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            aggregateVerdict: isAggregateVerdict(row.aggregateVerdict) ? row.aggregateVerdict : null,
            rulesEvaluatedCount: row.rulesEvaluatedCount,
        }));
    }
}

function mapBackfillTurn(row: {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly status: string;
    readonly assistantText: string | null;
    readonly askedText: string | null;
}): BackfillTurnRow {
    return {
        id: row.id,
        sessionId: row.sessionId,
        taskId: row.taskId,
        status: row.status === "open" ? "open" : "closed",
        assistantText: row.assistantText ?? "",
        userMessageText: row.askedText ?? "",
    };
}

function isAggregateVerdict(
    value: string | null,
): value is "verified" | "unverifiable" | "contradicted" {
    return value === "verified" || value === "unverifiable" || value === "contradicted";
}
