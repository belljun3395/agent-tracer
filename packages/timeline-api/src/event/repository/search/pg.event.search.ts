import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { normalizeLane } from "@monitor/timeline-api/event/domain/event.lane.js";
import type {
    EventSearchIndexQueryOptions,
    EventSearchIndexResults,
    IEventSearchIndex,
} from "@monitor/timeline-api/event/application/outbound/event.search.index.port.js";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 8;

interface EventRow {
    readonly id: string;
    readonly task_id: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body: string | null;
    readonly created_at: string;
}

/**
 * Postgres event search (pg_trgm-backed ILIKE over timeline_events). Queries the
 * source table directly — no separate index, no dual-write. timeline stays a
 * leaf: it searches only its own events and never reads the tasks table, so the
 * hit's taskTitle is left blank for the web (which owns task data) to fill.
 * Task search lives in work (`/api/v1/tasks/search`).
 */
@Injectable()
export class PgEventSearch implements IEventSearchIndex {
    constructor(private readonly dataSource: DataSource) {}

    async search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults> {
        const trimmed = query.trim();
        if (!trimmed) return { events: [] };
        const limit = Math.max(1, Math.min(MAX_LIMIT, options.limit ?? DEFAULT_LIMIT));
        const userId = currentUserId();
        const pattern = `%${trimmed}%`;
        const rows = await this.dataSource.query<readonly EventRow[]>(
            `select id, task_id, kind, lane, title, body, created_at
             from timeline_events
             where user_id = $1
               and ($2::text is null or task_id = $2)
               and (title ilike $3 or coalesce(body, '') ilike $3 or kind ilike $3 or lane ilike $3)
             order by created_at desc
             limit $4`,
            [userId, options.taskId ?? null, pattern, limit],
        );
        const events = rows.map((row) => ({
            id: row.id,
            eventId: row.id,
            taskId: row.task_id,
            taskTitle: "",
            title: row.title,
            lane: normalizeLane(row.lane),
            kind: row.kind,
            createdAt: row.created_at,
            ...(row.body ? { snippet: row.body } : {}),
        }));
        return { events };
    }
}
