import type { TimelineEvent } from "~domain/monitoring/index.js";
import type { EventInsertInput, IEventRepository, SearchOptions, SearchResults } from "~application/ports/repository/event.repository.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { refreshEventSearchDocument, searchEvents } from "../search/sqlite.event.search.js";
import { appendDomainEvent, mapTimelineInsertToDomainEvent } from "../events/index.js";
import {
    buildEventStorageValues,
    loadTimelineEventById,
    loadTimelineEventsForTask,
    syncEventDerivedTables,
} from "./sqlite.event.storage.js";

export class SqliteEventRepository implements IEventRepository {
    private readonly db: SqliteDatabase;

    constructor(db: SqliteDatabaseInput, private readonly embeddingService?: IEmbeddingService) {
        this.db = ensureSqliteDatabase(db);
    }

    async insert(input: EventInsertInput): Promise<TimelineEvent> {
        this.db.client.transaction(() => {
            const storage = buildEventStorageValues(input);
            this.db.client.prepare(`
              insert into timeline_events_view (
                id, task_id, session_id, kind, lane, title, body,
                subtype_key, subtype_label, subtype_group, tool_family, operation,
                source_tool, tool_name, entity_type, entity_name, display_title,
                evidence_level, extras_json, created_at
              ) values (
                @id, @taskId, @sessionId, @kind, @lane, @title, @body,
                @subtypeKey, @subtypeLabel, @subtypeGroup, @toolFamily, @operation,
                @sourceTool, @toolName, @entityType, @entityName, @displayTitle,
                @evidenceLevel, @metadataJson, @createdAt
              )
            `).run(storage);
            syncEventDerivedTables(this.db.client, input);

            const domainEvent = mapTimelineInsertToDomainEvent(input);
            if (domainEvent) {
                appendDomainEvent(this.db.client, domainEvent);
            }

            refreshEventSearchDocument(this.db, input.id);
        })();
        return (await this.findById(input.id))!;
    }

    async findById(id: string): Promise<TimelineEvent | null> {
        return loadTimelineEventById(this.db.client, id);
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
        return loadTimelineEventsForTask(this.db.client, taskId);
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null> {
        const existing = await this.findById(eventId);
        if (!existing) {
            return null;
        }

        this.db.client.transaction(() => {
            const storage = buildEventStorageValues({
                ...existing,
                metadata,
                classification: existing.classification,
            });
            this.db.client.prepare(`
              update timeline_events_view
              set subtype_key = @subtypeKey,
                  subtype_label = @subtypeLabel,
                  subtype_group = @subtypeGroup,
                  tool_family = @toolFamily,
                  operation = @operation,
                  source_tool = @sourceTool,
                  tool_name = @toolName,
                  entity_type = @entityType,
                  entity_name = @entityName,
                  display_title = @displayTitle,
                  evidence_level = @evidenceLevel,
                  extras_json = @metadataJson
              where id = @id
            `).run(storage);
            syncEventDerivedTables(this.db.client, {
                ...existing,
                metadata,
                classification: existing.classification,
            });
            refreshEventSearchDocument(this.db, eventId);
        })();
        return this.findById(eventId);
    }

    async search(query: string, opts?: SearchOptions): Promise<SearchResults> {
        return searchEvents(this.db.client, this.embeddingService, query, opts);
    }
}
