import { eq } from "drizzle-orm";
import type { TimelineEvent } from "~domain/monitoring/timeline.event.model.js";
import type { EventInsertInput, IEventRepository, SearchOptions, SearchResults } from "~application/ports/repository/event.repository.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { timelineEvents } from "../schema/drizzle.schema.js";
import { refreshEventSearchDocument, searchEvents } from "../search/sqlite.event.search.js";
import { appendDomainEvent, mapTimelineInsertToDomainEvent } from "../events/index.js";
import { type EventRow, mapEventRow } from "./sqlite.event.row.type.js";

export class SqliteEventRepository implements IEventRepository {
    private readonly db: SqliteDatabase;

    constructor(db: SqliteDatabaseInput, private readonly embeddingService?: IEmbeddingService) {
        this.db = ensureSqliteDatabase(db);
    }

    async insert(input: EventInsertInput): Promise<TimelineEvent> {
        this.db.client.transaction(() => {
            this.db.orm.insert(timelineEvents).values({
                id: input.id,
                taskId: input.taskId,
                sessionId: input.sessionId ?? null,
                kind: input.kind,
                lane: input.lane,
                title: input.title,
                body: input.body ?? null,
                metadataJson: JSON.stringify(input.metadata),
                classificationJson: JSON.stringify(input.classification),
                createdAt: input.createdAt
            }).run();

            const domainEvent = mapTimelineInsertToDomainEvent(input);
            if (domainEvent) {
                appendDomainEvent(this.db.client, domainEvent);
            }

            refreshEventSearchDocument(this.db, input.id);
        })();
        return (await this.findById(input.id))!;
    }

    async findById(id: string): Promise<TimelineEvent | null> {
        const row = this.db.orm.query.timelineEvents.findFirst({
            where: (fields, operators) => operators.eq(fields.id, id)
        }).sync() as EventRow | undefined;

        return row ? mapEventRow(row) : null;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
        const rows = this.db.orm.query.timelineEvents.findMany({
            where: (fields, operators) => operators.eq(fields.taskId, taskId),
            orderBy: (fields, operators) => operators.asc(fields.createdAt)
        }).sync() as readonly EventRow[];

        return rows.map(mapEventRow);
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null> {
        const existing = await this.findById(eventId);
        if (!existing) {
            return null;
        }

        this.db.orm.update(timelineEvents)
            .set({ metadataJson: JSON.stringify(metadata) })
            .where(eq(timelineEvents.id, eventId))
            .run();

        refreshEventSearchDocument(this.db, eventId);
        return this.findById(eventId);
    }

    async search(query: string, opts?: SearchOptions): Promise<SearchResults> {
        return searchEvents(this.db.client, this.embeddingService, query, opts);
    }
}
