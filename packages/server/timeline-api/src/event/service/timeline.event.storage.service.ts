import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { LANE, type MonitoringEventKind } from "@monitor/timeline-api/event/domain/common/const/event.kind.const.js";
import { normalizeLane } from "@monitor/timeline-api/event/domain/event.lane.policy.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/domain/model/timeline.event.model.js";
import { EventMetadata } from "../domain/event.metadata.vo.js";
import { TimelineEventEntity } from "../domain/timeline.event.entity.js";
import type { TimelineEventInsertRequest } from "../application/outbound/event.persistence.port.js";
import { TimelineEventRepository } from "../repository/timeline.event.repository.js";

@Injectable()
export class TimelineEventStorageService {
    constructor(
        private readonly timelineEvents: TimelineEventRepository,
        private readonly dataSource: DataSource,
    ) {}

    async insert(input: TimelineEventInsertRequest): Promise<TimelineEvent> {
        await this.timelineEvents.save(this.buildRow(input));
        const loaded = await this.findById(input.id);
        if (!loaded) {
            throw new Error(`Failed to reload inserted timeline event ${input.id}`);
        }
        return loaded;
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null> {
        const existing = await this.findById(eventId);
        if (!existing) return null;
        const refreshed: TimelineEventInsertRequest = { ...existing, metadata };
        await this.timelineEvents.save(this.buildRow(refreshed));
        return this.findById(eventId);
    }

    async findById(id: string): Promise<TimelineEvent | null> {
        const row = await this.timelineEvents.findOwned(id, currentUserId());
        if (!row) return null;
        const [event] = await this.applyRuleLaneOverride([this.toEvent(row)]);
        return event ?? null;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
        const rows = await this.timelineEvents.findByTaskIdOrdered(taskId, currentUserId());
        return this.applyRuleLaneOverride(rows.map((row) => this.toEvent(row)));
    }

    private buildRow(input: TimelineEventInsertRequest): TimelineEventEntity {
        // 저장 직전 metadata를 한 번 정규화해 blob·tags·인덱스 컬럼으로 만든다.
        const normalized = EventMetadata.normalize(input);
        const entity = new TimelineEventEntity();
        entity.id = input.id;
        entity.taskId = input.taskId;
        entity.sessionId = input.sessionId ?? null;
        entity.kind = input.kind;
        entity.lane = input.lane;
        entity.title = input.title;
        entity.body = input.body ?? null;
        entity.subtypeKey = normalized.columns.subtypeKey;
        entity.subtypeLabel = normalized.columns.subtypeLabel;
        entity.subtypeGroup = normalized.columns.subtypeGroup;
        entity.toolFamily = normalized.columns.toolFamily;
        entity.operation = normalized.columns.operation;
        entity.sourceTool = normalized.columns.sourceTool;
        entity.toolName = normalized.columns.toolName;
        entity.entityType = normalized.columns.entityType;
        entity.entityName = normalized.columns.entityName;
        entity.displayTitle = normalized.columns.displayTitle;
        entity.evidenceLevel = normalized.columns.evidenceLevel;
        entity.userId = currentUserId();
        entity.metadata = normalized.metadata;
        entity.tags = [...normalized.tags];
        entity.createdAt = input.createdAt;
        return entity;
    }

    private toEvent(row: TimelineEventEntity): TimelineEvent {
        const lane = normalizeLane(row.lane);
        return {
            id: row.id,
            taskId: row.taskId,
            kind: row.kind as MonitoringEventKind,
            lane,
            title: row.title,
            metadata: row.metadata,
            classification: { lane, tags: row.tags, matches: [] },
            createdAt: row.createdAt,
            ...(row.sessionId ? { sessionId: row.sessionId } : {}),
            ...(row.body ? { body: row.body } : {}),
        };
    }

    private async applyRuleLaneOverride<T extends TimelineEvent>(
        events: readonly T[],
    ): Promise<readonly T[]> {
        if (events.length === 0) return events;
        const ids = events.map((e) => e.id);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.dataSource.query<readonly { event_id: string; rule_id: string; match_kind: string }[]>(
            `select event_id, rule_id, match_kind
             from rule_enforcements
             where event_id in (${placeholders})
             order by decided_at asc, rule_id asc, match_kind asc`,
            ids,
        );
        if (rows.length === 0) return events;
        // 룰 강제 결과가 있는 이벤트는 읽기 모델에서 룰 레인으로 보여준다.
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
                lane: LANE.rule,
                classification: {
                    ...e.classification,
                    lane: LANE.rule,
                    matches: ruleEnforcements.map((r) => ({
                        ruleId: r.ruleId,
                        score: 1,
                        tags: [],
                        reasons: [],
                    })),
                },
                metadata: {
                    ...e.metadata,
                    ruleEnforcements,
                    ...(e.lane === LANE.rule ? {} : { originalLane: e.lane }),
                },
            } as T;
        });
    }
}
