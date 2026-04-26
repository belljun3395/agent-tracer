import type Database from "better-sqlite3";
import type {
    TurnCardView,
    TurnEventView,
    TurnReceiptView,
    TurnVerdictView,
    VerdictStatus,
} from "~domain/verification/index.js";
import type {
    BackfillTurnRow,
    ITurnQueryRepository,
    ListTurnsArgs,
    ListTurnsResult,
} from "~application/ports/repository/turn.query.repository.js";
import { aggregateVerdict, tallyVerdicts } from "~domain/verification/index.js";
import { buildPreviewLines, type PreviewSourceEvent } from "~application/verification/query/preview-lines.js";
import { inferToolCall } from "~application/verification/infer.tool.call.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";

export type { ListTurnsArgs, ListTurnsResult, BackfillTurnRow };

interface TurnRow {
    readonly id: string;
    readonly session_id: string;
    readonly task_id: string;
    readonly index: number;
    readonly task_index: number;
    readonly started_at: string;
    readonly ended_at: string;
    readonly asked_text: string | null;
    readonly assistant_text: string;
    readonly summary_markdown: string | null;
    readonly rules_evaluated_count: number;
}

interface VerdictRow {
    readonly id: string;
    readonly turn_id: string;
    readonly rule_id: string;
    readonly status: string;
    readonly detail_json: string;
    readonly evaluated_at: string;
}

interface EventRow {
    readonly id: string;
    readonly turn_id: string;
    readonly kind: string;
    readonly title: string;
    readonly body: string | null;
    readonly tool_name: string | null;
    readonly extras_json: string;
    readonly created_at: string;
}

interface BackfillTurnSqlRow {
    readonly id: string;
    readonly session_id: string;
    readonly task_id: string;
    readonly assistant_text: string;
    readonly ended_at: string;
    readonly rules_evaluated_count: number;
}

/**
 * Common CTE that adds a `task_index` column to turns: a 1-based ordinal
 * within a task, ordered by `started_at`. Both list and receipt queries
 * use this so the dashboard can label turns "1/2/3" task-wide instead of
 * the session-local `index`.
 */
const RANKED_TURNS_CTE = `
    with ranked as (
        select t.id, t.session_id, t."index", t.started_at, t.ended_at,
               t.assistant_text, t.summary_markdown, t.rules_evaluated_count,
               s.task_id,
               row_number() over (partition by s.task_id order by t.started_at asc) as task_index
        from turns_current t
        inner join sessions_current s on s.id = t.session_id
    )
`;

function extractToolCalls(events: readonly EventRow[]): BackfillTurnRow["toolCalls"] {
    const out: { tool: string; command?: string; filePath?: string }[] = [];
    for (const event of events) {
        const metadata = parseMetadata(event.extras_json) ?? {};
        // toolName is promoted to its own column and excluded from extras_json;
        // re-inject it so inferToolCall can match Read/Edit/Write events.
        if (event.tool_name && !metadata["toolName"]) {
            metadata["toolName"] = event.tool_name;
        }
        const toolCall = inferToolCall({ kind: event.kind, metadata });
        if (toolCall !== null) out.push(toolCall);
    }
    return out;
}

export class SqliteTurnQueryRepository implements ITurnQueryRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async listTurns(args: ListTurnsArgs): Promise<ListTurnsResult> {
        const limit = args.limit;
        const conditions: string[] = [];
        const params: Record<string, unknown> = { limit: limit + 1 };
        if (args.sessionId) {
            conditions.push("t.session_id = @sessionId");
            params["sessionId"] = args.sessionId;
        }
        if (args.taskId) {
            conditions.push("t.task_id = @taskId");
            params["taskId"] = args.taskId;
        }
        if (args.cursor) {
            conditions.push("t.started_at < @cursor");
            params["cursor"] = args.cursor;
        }
        const whereClause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

        // task_index = 1-based chronological position within the task. spec §2.3
        // keeps turn.index session-local; this gives us a task-wide ordinal so
        // the UI can label cards 1/2/3/4 instead of "Turn 0" repeating once
        // per session.
        const rows = this.db
            .prepare<Record<string, unknown>, TurnRow>(`
                ${RANKED_TURNS_CTE}
                select id, session_id, task_id, "index", task_index, started_at, ended_at,
                       assistant_text, summary_markdown, rules_evaluated_count,
                       (select coalesce(body, title)
                        from timeline_events_view
                        where task_id = t.task_id
                          and kind = 'user.message'
                          and created_at <= t.ended_at
                        order by created_at desc
                        limit 1) as asked_text
                from ranked t
                ${whereClause}
                order by t.started_at desc
                limit @limit
            `)
            .all(params);

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const ids = pageRows.map((r) => r.id);

        const verdictsByTurn = this.loadVerdictsByTurn(ids);
        const eventCountsByTurn = this.loadEventCounts(ids);
        const previewEventsByTurn = this.loadPreviewEvents(ids);

        const items: TurnCardView[] = pageRows.map((row) => {
            const verdicts = verdictsByTurn.get(row.id) ?? [];
            const statuses = verdicts.map((v) => v.status);
            const counts = tallyVerdicts(statuses);
            const aggregate = aggregateVerdict(statuses);
            const previewSources = previewEventsByTurn.get(row.id) ?? [];
            return {
                id: row.id,
                sessionId: row.session_id,
                taskId: row.task_id,
                index: row.index,
                taskIndex: row.task_index,
                startedAt: row.started_at,
                endedAt: row.ended_at,
                askedText: row.asked_text,
                assistantText: row.assistant_text,
                aggregateVerdict: aggregate,
                eventCount: eventCountsByTurn.get(row.id) ?? 0,
                verdictCount: counts,
                rulesEvaluatedCount: row.rules_evaluated_count,
                previewLines: [...buildPreviewLines(previewSources)],
            };
        });

        const filtered = args.verdict && args.verdict !== "all"
            ? items.filter((i) => i.aggregateVerdict === args.verdict)
            : items;

        const nextCursor = hasMore && pageRows.length > 0
            ? pageRows[pageRows.length - 1]!.started_at
            : null;

        return { items: filtered, nextCursor };
    }

    async getReceipt(turnId: string): Promise<TurnReceiptView | null> {
        const turnRow = this.db
            .prepare<{ id: string }, TurnRow & { task_id: string }>(`
                ${RANKED_TURNS_CTE}
                select id, session_id, "index", task_index, started_at, ended_at,
                       assistant_text, summary_markdown, rules_evaluated_count,
                       task_id
                from ranked
                where id = @id
            `)
            .get({ id: turnId });
        if (!turnRow) return null;

        const verdicts = this.loadVerdictsByTurn([turnId]).get(turnId) ?? [];
        const verdictDtos: TurnVerdictView[] = verdicts.map(verdictRowToDto);

        const events = this.loadEventsForReceipt(turnId);

        const statuses = verdicts.map((v) => v.status);
        const counts = tallyVerdicts(statuses);
        const aggregate = aggregateVerdict(statuses);
        const previewSources = events.slice(0, 3).map<PreviewSourceEvent>((e) => ({
            kind: e.kind,
            title: e.title,
            ...(e.metadata ? { metadata: e.metadata } : {}),
        }));

        const askedText = this.loadPrecedingUserMessage({
            taskId: turnRow.task_id,
            endedAt: turnRow.ended_at,
        });

        const card: TurnCardView = {
            id: turnRow.id,
            sessionId: turnRow.session_id,
            taskId: turnRow.task_id,
            index: turnRow.index,
            taskIndex: turnRow.task_index,
            startedAt: turnRow.started_at,
            endedAt: turnRow.ended_at,
            askedText,
            assistantText: turnRow.assistant_text,
            aggregateVerdict: aggregate,
            eventCount: events.length,
            verdictCount: counts,
            rulesEvaluatedCount: turnRow.rules_evaluated_count,
            previewLines: [...buildPreviewLines(previewSources)],
        };

        return {
            card,
            askedText,
            verdicts: verdictDtos,
            events,
            summaryMarkdown: turnRow.summary_markdown,
        };
    }

    async listTurnsForBackfill(args: {
        readonly scope: "global" | "task";
        readonly taskId?: string;
    }): Promise<ReadonlyArray<BackfillTurnRow>> {
        const params: Record<string, string> = {};
        let whereClause = "";
        if (args.scope === "task") {
            if (!args.taskId) return [];
            whereClause = "where s.task_id = @taskId";
            params["taskId"] = args.taskId;
        }
        const turns = this.db
            .prepare<Record<string, string>, BackfillTurnSqlRow>(`
                select t.id, t.session_id, t.assistant_text, t.ended_at, t.rules_evaluated_count,
                       s.task_id as task_id
                from turns_current t
                inner join sessions_current s on s.id = t.session_id
                ${whereClause}
                order by t.started_at asc
            `)
            .all(params);
        if (turns.length === 0) return [];

        const ids = turns.map((t) => t.id);
        const eventsByTurn = this.loadEventsByTurnIds(ids);
        return turns.map((t) => ({
            id: t.id,
            sessionId: t.session_id,
            taskId: t.task_id,
            assistantText: t.assistant_text,
            userMessageText: this.loadPrecedingUserMessage({
                taskId: t.task_id,
                endedAt: t.ended_at,
            }) ?? "",
            rulesEvaluatedCount: t.rules_evaluated_count,
            toolCalls: extractToolCalls(eventsByTurn.get(t.id) ?? []),
        }));
    }

    private loadEventsByTurnIds(turnIds: readonly string[]): Map<string, EventRow[]> {
        const map = new Map<string, EventRow[]>();
        if (turnIds.length === 0) return map;
        const placeholders = turnIds.map((_, i) => `@id${i}`).join(",");
        const params: Record<string, string> = {};
        turnIds.forEach((id, i) => {
            params[`id${i}`] = id;
        });
        const rows = this.db
            .prepare<Record<string, string>, EventRow>(`
                select l.turn_id as turn_id, e.id as id, e.kind as kind, e.title as title,
                       e.body as body, e.tool_name as tool_name,
                       e.extras_json as extras_json, e.created_at as created_at
                from turn_event_links l
                inner join timeline_events_view e on e.id = l.event_id
                where l.turn_id in (${placeholders})
                order by e.created_at asc
            `)
            .all(params);
        for (const row of rows) {
            const list = map.get(row.turn_id) ?? [];
            list.push(row);
            map.set(row.turn_id, list);
        }
        return map;
    }

    async getCachedSummary(turnId: string): Promise<string | null> {
        const row = this.db
            .prepare<{ turnId: string }, { summary_markdown: string | null }>(`
                select summary_markdown
                from turns_current
                where id = @turnId
            `)
            .get({ turnId });
        return row?.summary_markdown ?? null;
    }

    async updateSummaryMarkdown(turnId: string, markdown: string): Promise<void> {
        this.db
            .prepare("update turns_current set summary_markdown = @markdown where id = @turnId")
            .run({ turnId, markdown });
    }

    private loadVerdictsByTurn(turnIds: readonly string[]): Map<string, VerdictRow[]> {
        const map = new Map<string, VerdictRow[]>();
        if (turnIds.length === 0) return map;
        const placeholders = turnIds.map((_, i) => `@id${i}`).join(",");
        const params: Record<string, string> = {};
        turnIds.forEach((id, i) => {
            params[`id${i}`] = id;
        });
        const rows = this.db
            .prepare<Record<string, string>, VerdictRow>(`
                select id, turn_id, rule_id, status, detail_json, evaluated_at
                from turn_verdicts
                where turn_id in (${placeholders})
                order by evaluated_at asc
            `)
            .all(params);
        for (const row of rows) {
            const list = map.get(row.turn_id) ?? [];
            list.push(row);
            map.set(row.turn_id, list);
        }
        return map;
    }

    private loadEventCounts(turnIds: readonly string[]): Map<string, number> {
        const map = new Map<string, number>();
        if (turnIds.length === 0) return map;
        const placeholders = turnIds.map((_, i) => `@id${i}`).join(",");
        const params: Record<string, string> = {};
        turnIds.forEach((id, i) => {
            params[`id${i}`] = id;
        });
        const rows = this.db
            .prepare<Record<string, string>, { turn_id: string; n: number }>(`
                select turn_id, count(*) as n
                from turn_event_links
                where turn_id in (${placeholders})
                group by turn_id
            `)
            .all(params);
        for (const row of rows) {
            map.set(row.turn_id, row.n);
        }
        return map;
    }

    private loadPreviewEvents(turnIds: readonly string[]): Map<string, PreviewSourceEvent[]> {
        const map = new Map<string, PreviewSourceEvent[]>();
        if (turnIds.length === 0) return map;
        const placeholders = turnIds.map((_, i) => `@id${i}`).join(",");
        const params: Record<string, string> = {};
        turnIds.forEach((id, i) => {
            params[`id${i}`] = id;
        });
        const rows = this.db
            .prepare<Record<string, string>, EventRow>(`
                select l.turn_id as turn_id, e.id as id, e.kind as kind, e.title as title,
                       e.body as body, e.tool_name as tool_name,
                       e.extras_json as extras_json, e.created_at as created_at
                from turn_event_links l
                inner join timeline_events_view e on e.id = l.event_id
                where l.turn_id in (${placeholders})
                order by e.created_at asc
            `)
            .all(params);
        for (const row of rows) {
            const list = map.get(row.turn_id) ?? [];
            const metadata = parseMetadata(row.extras_json);
            list.push({
                kind: row.kind,
                title: row.title,
                ...(metadata ? { metadata } : {}),
            });
            map.set(row.turn_id, list);
        }
        return map;
    }

    private loadEventsForReceipt(turnId: string): TurnEventView[] {
        const rows = this.db
            .prepare<{ turnId: string }, EventRow>(`
                select e.id as id, e.kind as kind, e.title as title, e.body as body,
                       e.extras_json as extras_json, e.created_at as created_at,
                       l.turn_id as turn_id
                from turn_event_links l
                inner join timeline_events_view e on e.id = l.event_id
                where l.turn_id = @turnId
                order by e.created_at asc
            `)
            .all({ turnId });
        return rows.map((row) => {
            const metadata = parseMetadata(row.extras_json);
            return {
                id: row.id,
                kind: row.kind,
                title: row.title,
                body: row.body,
                occurredAt: row.created_at,
                ...(metadata ? { metadata } : {}),
            };
        });
    }

    /**
     * Find the user.message that *belongs to* this turn — i.e. the most
     * recent user.message at or before the turn's ended_at. Using endedAt
     * (not startedAt) is intentional: the turn's first event is often the
     * user.message itself, so a strict `<startedAt` filter would skip the
     * turn's own ASKED and pick up the prior turn's user.message instead.
     */
    private loadPrecedingUserMessage(args: { taskId: string; endedAt: string }): string | null {
        const row = this.db
            .prepare<{ taskId: string; endedAt: string }, { body: string | null; title: string }>(`
                select body, title
                from timeline_events_view
                where task_id = @taskId
                  and kind = 'user.message'
                  and created_at <= @endedAt
                order by created_at desc
                limit 1
            `)
            .get({ taskId: args.taskId, endedAt: args.endedAt });
        if (!row) return null;
        const text = row.body ?? row.title;
        return text || null;
    }
}

function verdictRowToDto(row: VerdictRow): TurnVerdictView {
    let parsed: Record<string, unknown> = {};
    try {
        parsed = JSON.parse(row.detail_json || "{}") as Record<string, unknown>;
    } catch {
        parsed = {};
    }
    const rawMatchedPhrase = parsed["matchedPhrase"];
    const matchedPhrase = typeof rawMatchedPhrase === "string" ? rawMatchedPhrase : null;
    const rawExpectedPattern = parsed["expectedPattern"];
    const expectedPattern = typeof rawExpectedPattern === "string" ? rawExpectedPattern : null;
    const rawActualToolCalls = parsed["actualToolCalls"];
    const actualToolCalls = Array.isArray(rawActualToolCalls)
        ? rawActualToolCalls.filter((v): v is string => typeof v === "string")
        : [];
    const rawMatchedToolCalls = parsed["matchedToolCalls"];
    const matchedToolCalls = Array.isArray(rawMatchedToolCalls)
        ? rawMatchedToolCalls.filter((v): v is string => typeof v === "string")
        : null;
    return {
        id: row.id,
        ruleId: row.rule_id,
        status: row.status as VerdictStatus,
        matchedPhrase,
        expectedPattern,
        actualToolCalls,
        matchedToolCalls,
        evaluatedAt: row.evaluated_at,
    };
}

function parseMetadata(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}
