import type Database from "better-sqlite3";
import type { TimelineEvent } from "~domain/monitoring/index.js";
import type { EventInsertInput, IEventRepository, SearchOptions, SearchResults } from "~application/ports/repository/event.repository.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { refreshEventSearchDocument, searchEvents } from "../search/sqlite.event.search.js";
import { appendDomainEvent } from "../events/index.js";
import { mapTimelineInsertToDomainEvent } from "./timeline-event.mapper.js";
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
        const event = loadTimelineEventById(this.db.client, id);
        if (!event) return null;
        const overridden = applyRuleLaneOverride(this.db.client, [event]);
        return overridden[0] ?? event;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
        const events = loadTimelineEventsForTask(this.db.client, taskId);
        return applyRuleLaneOverride(this.db.client, events);
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

/**
 * Read-time lane override: any event with at least one rule_enforcements
 * row gets its lane forced to "rule". Original lane is preserved in
 * metadata.originalLane for clients that need it.
 */
function applyRuleLaneOverride<T extends TimelineEvent>(
    client: Database.Database,
    events: readonly T[],
): readonly T[] {
    if (events.length === 0) return events;
    const ids = events.map((e) => e.id);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = client
        .prepare<string[], { event_id: string; rule_id: string; match_kind: string }>(
            `select event_id, rule_id, match_kind
             from rule_enforcements
             where event_id in (${placeholders})
             order by decided_at asc, rule_id asc, match_kind asc`,
        )
        .all(...ids);
    const byEvent = new Map<string, Array<{ ruleId: string; matchKind: string }>>();
    for (const row of rows) {
        const list = byEvent.get(row.event_id) ?? [];
        list.push({ ruleId: row.rule_id, matchKind: row.match_kind });
        byEvent.set(row.event_id, list);
    }
    if (byEvent.size === 0) return events;
    return events.map((e) => {
        const ruleEnforcements = byEvent.get(e.id);
        if (!ruleEnforcements) return e;
        return {
            ...e,
            lane: "rule" as const,
            metadata: {
                ...e.metadata,
                ruleEnforcements,
                ...(e.lane === "rule" ? {} : { originalLane: e.lane }),
            },
        } as T;
    });
}
