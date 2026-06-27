import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { LANE, type MonitoringEventKind } from "@monitor/activity-api/event/domain/common/const/event.kind.const.js";
import { normalizeLane } from "@monitor/activity-api/event/domain/event.lane.js";
import type { TimelineEvent } from "@monitor/activity-api/event/domain/model/timeline.event.model.js";
import {
    buildDerivedTableInserts,
    buildTimelineEventEntity,
} from "../domain/timeline.event.row.builder.js";
import { hydrateTimelineEvent } from "../domain/timeline.event.hydrator.js";
import { TimelineEventEntity } from "../domain/timeline.event.entity.js";
import type { TimelineEventInsertRequest } from "../application/outbound/event.persistence.port.js";
import { TimelineEventRepository } from "../repository/timeline.event.repository.js";

/**
 * 타임라인 이벤트의 읽기/쓰기를 담당하는 내부 서비스. 이벤트는 단일 행으로
 * 저장한다 — 쓰기 시점에 metadata 를 정규화해 jsonb 컬럼에 담고, 읽을 때는 그
 * 행을 그대로 매핑한다(조인/하이드레이트 없음).
 */
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
        const row = await this.timelineEvents.findById(id);
        if (!row) return null;
        const [event] = await this.applyRuleLaneOverride([this.toEvent(row)]);
        return event ?? null;
    }

    async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
        const rows = await this.timelineEvents.findByTaskIdOrdered(taskId);
        return this.applyRuleLaneOverride(rows.map((row) => this.toEvent(row)));
    }

    /** 입력을 정규화해 단일 이벤트 행으로 만든다(파생 필드는 jsonb metadata/tags 에 흡수). */
    private buildRow(input: TimelineEventInsertRequest): TimelineEventEntity {
        const entity = buildTimelineEventEntity(input);
        const hydrated = hydrateTimelineEvent(entity, buildDerivedTableInserts(input));
        entity.userId = currentUserId();
        entity.metadata = hydrated.metadata;
        entity.tags = [...hydrated.classification.tags];
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

    /**
     * 읽기 시점에 rule_enforcements 를 타임라인 이벤트에 투영한다. enforcement 가
     * 있는 이벤트는 lane 을 "rule" 로 바꾸고 classification.matches 를 채운다.
     */
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
