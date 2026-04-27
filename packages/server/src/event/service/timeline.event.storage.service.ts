import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import {
    buildDerivedTableInserts,
    buildTimelineEventEntity,
} from "../domain/timeline.event.row.builder.js";
import {
    emptySupplements,
    hydrateTimelineEvent,
    indexSupplementsByEventId,
} from "../domain/timeline.event.hydrator.js";
import type { TimelineEventEntity } from "../domain/timeline.event.entity.js";
import type { TimelineEventInsertRequest } from "../application/outbound/event.persistence.port.js";
import { TimelineEventRepository } from "../repository/timeline.event.repository.js";
import { EventFileRepository } from "../repository/event.file.repository.js";
import { EventRelationRepository } from "../repository/event.relation.repository.js";
import { EventAsyncRefRepository } from "../repository/event.async.ref.repository.js";
import { EventTagRepository } from "../repository/event.tag.repository.js";
import { TodoCurrentRepository } from "../repository/todo.current.repository.js";
import { QuestionCurrentRepository } from "../repository/question.current.repository.js";
import { EventTokenUsageRepository } from "../repository/event.token.usage.repository.js";

/**
 * Internal service — owns the multi-table write/read flow for timeline events.
 * Sync derived tables on write, hydrate them back on read. Stays inside event
 * module so the persistence concern doesn't leak.
 */
@Injectable()
export class TimelineEventStorageService {
    constructor(
        private readonly timelineEvents: TimelineEventRepository,
        private readonly files: EventFileRepository,
        private readonly relations: EventRelationRepository,
        private readonly asyncRefs: EventAsyncRefRepository,
        private readonly tags: EventTagRepository,
        private readonly todos: TodoCurrentRepository,
        private readonly questions: QuestionCurrentRepository,
        private readonly tokenUsage: EventTokenUsageRepository,
        private readonly dataSource: DataSource,
    ) {}

    async insert(input: TimelineEventInsertRequest): Promise<TimelineEvent> {
        const entity = buildTimelineEventEntity(input);
        const derived = buildDerivedTableInserts(input);
        await this.dataSource.transaction(async () => {
            await this.timelineEvents.save(entity);
            await this.syncDerivedTables(input.id, derived);
        });
        const loaded = await this.findById(input.id);
        if (!loaded) {
            throw new Error(`Failed to reload inserted timeline event ${input.id}`);
        }
        return loaded;
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null> {
        const existing = await this.findById(eventId);
        if (!existing) return null;

        const refreshed = {
            ...existing,
            metadata,
        } as unknown as TimelineEventInsertRequest;
        const entity = buildTimelineEventEntity(refreshed);
        const derived = buildDerivedTableInserts(refreshed);

        await this.dataSource.transaction(async () => {
            await this.timelineEvents.updateExtras(eventId, {
                subtypeKey: entity.subtypeKey,
                subtypeLabel: entity.subtypeLabel,
                subtypeGroup: entity.subtypeGroup,
                toolFamily: entity.toolFamily,
                operation: entity.operation,
                sourceTool: entity.sourceTool,
                toolName: entity.toolName,
                entityType: entity.entityType,
                entityName: entity.entityName,
                displayTitle: entity.displayTitle,
                evidenceLevel: entity.evidenceLevel,
                extrasJson: entity.extrasJson,
            });
            await this.syncDerivedTables(eventId, derived);
        });

        return this.findById(eventId);
    }

    async findById(id: string): Promise<TimelineEvent | null> {
        const row = await this.timelineEvents.findById(id);
        if (!row) return null;
        const supplements = await this.loadSupplements([id]);
        const hydrated = hydrateTimelineEvent(row, supplements.get(id) ?? emptySupplements());
        return (await this.applyRuleLaneOverride([hydrated]))[0] ?? hydrated;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
        const rows = await this.timelineEvents.findByTaskIdOrdered(taskId);
        return this.hydrateRows(rows);
    }

    private async hydrateRows(rows: readonly TimelineEventEntity[]): Promise<readonly TimelineEvent[]> {
        if (rows.length === 0) return [];
        const supplements = await this.loadSupplements(rows.map((r) => r.id));
        const hydrated = rows.map((row) => hydrateTimelineEvent(row, supplements.get(row.id) ?? emptySupplements()));
        return this.applyRuleLaneOverride(hydrated);
    }

    private async syncDerivedTables(eventId: string, derived: ReturnType<typeof buildDerivedTableInserts>): Promise<void> {
        await Promise.all([
            this.files.deleteByEventId(eventId),
            this.relations.deleteByEventId(eventId),
            this.asyncRefs.deleteByEventId(eventId),
            this.tags.deleteByEventId(eventId),
            this.tokenUsage.deleteByEventId(eventId),
        ]);
        await this.files.insertMany(derived.files);
        await this.relations.insertManyIgnoreDuplicates(derived.relations);
        if (derived.asyncRef) await this.asyncRefs.insert(derived.asyncRef);
        await this.tags.insertMany(derived.tags);
        if (derived.todo) await this.todos.upsert(derived.todo);
        if (derived.question) await this.questions.upsert(derived.question);
        if (derived.tokenUsage) await this.tokenUsage.insert(derived.tokenUsage);
    }

    private async loadSupplements(eventIds: readonly string[]) {
        const [files, relations, asyncRefs, tags, todos, questions, tokenUsages] = await Promise.all([
            this.files.findByEventIds(eventIds),
            this.relations.findByEventIds(eventIds),
            this.asyncRefs.findByEventIds(eventIds),
            this.tags.findByEventIds(eventIds),
            this.todos.findByLastEventIds(eventIds),
            this.questions.findByLastEventIds(eventIds),
            this.tokenUsage.findByEventIds(eventIds),
        ]);
        return indexSupplementsByEventId(eventIds, files, relations, asyncRefs, tags, todos, questions, tokenUsages);
    }

    /**
     * Read-time lane override — events with rule_enforcements rows get lane=rule.
     * Cross-module read of rule_enforcements via raw query; will be replaced
     * with a rule-module outbound port when rule module migrates to TypeORM.
     */
    private async applyRuleLaneOverride<T extends TimelineEvent>(
        events: readonly T[],
    ): Promise<readonly T[]> {
        if (events.length === 0) return events;
        const ids = events.map((e) => e.id);
        const placeholders = ids.map(() => "?").join(", ");
        const rows = await this.dataSource.query<readonly { event_id: string; rule_id: string; match_kind: string }[]>(
            `select event_id, rule_id, match_kind
             from rule_enforcements
             where event_id in (${placeholders})
             order by decided_at asc, rule_id asc, match_kind asc`,
            ids,
        );
        if (rows.length === 0) return events;
        const byEvent = new Map<string, Array<{ ruleId: string; matchKind: string }>>();
        for (const row of rows) {
            const list = byEvent.get(row.event_id) ?? [];
            list.push({ ruleId: row.rule_id, matchKind: row.match_kind });
            byEvent.set(row.event_id, list);
        }
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
}
