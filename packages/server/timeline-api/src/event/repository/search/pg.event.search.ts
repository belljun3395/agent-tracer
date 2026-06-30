import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { normalizeLane } from "@monitor/timeline-api/event/domain/event.lane.policy.js";
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

@Injectable()
export class PgEventSearch implements IEventSearchIndex, OnModuleInit {
    private readonly logger = new Logger(PgEventSearch.name);

    constructor(private readonly dataSource: DataSource) {}

    async onModuleInit(): Promise<void> {
        try {
            await this.dataSource.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
            await this.dataSource.query(
                `CREATE INDEX IF NOT EXISTS idx_timeline_events_title_trgm
                 ON timeline_events USING gin (title gin_trgm_ops)`,
            );
            await this.dataSource.query(
                `CREATE INDEX IF NOT EXISTS idx_timeline_events_body_trgm
                 ON timeline_events USING gin (body gin_trgm_ops)`,
            );
        } catch (error) {
            this.logger.warn(
                `pg_trgm index bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

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
             order by created_at desc, seq desc
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
