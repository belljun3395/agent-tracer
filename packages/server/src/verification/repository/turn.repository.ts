import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    ITurnRepository,
    StoredTurn,
    TurnAggregateVerdict,
    TurnInsertInput,
} from "~verification/application/outbound/turn.repository.port.js";
import { TurnEntity } from "../domain/turn.entity.js";
import { TurnEventEntity } from "../domain/turn.event.entity.js";

@Injectable()
export class TurnRepository implements ITurnRepository {
    constructor(
        @InjectRepository(TurnEntity)
        private readonly repo: Repository<TurnEntity>,
        @InjectRepository(TurnEventEntity)
        private readonly eventRepo: Repository<TurnEventEntity>,
    ) {}

    async insert(input: TurnInsertInput): Promise<StoredTurn> {
        const entity = new TurnEntity();
        entity.id = input.id;
        entity.sessionId = input.sessionId;
        entity.taskId = input.taskId;
        entity.turnIndex = input.turnIndex;
        entity.status = input.status;
        entity.startedAt = input.startedAt;
        entity.endedAt = null;
        entity.askedText = input.askedText ?? null;
        entity.assistantText = null;
        entity.aggregateVerdict = null;
        entity.rulesEvaluatedCount = 0;
        const saved = await this.repo.save(entity);
        return mapEntity(saved);
    }

    async linkEvents(turnId: string, eventIds: readonly string[]): Promise<void> {
        if (eventIds.length === 0) return;
        const rows = eventIds.map((eventId) => {
            const row = new TurnEventEntity();
            row.turnId = turnId;
            row.eventId = eventId;
            return row;
        });
        await this.eventRepo
            .createQueryBuilder()
            .insert()
            .into(TurnEventEntity)
            .values(rows)
            .orIgnore()
            .execute();
    }

    async findById(turnId: string): Promise<StoredTurn | null> {
        const row = await this.repo.findOne({ where: { id: turnId } });
        return row ? mapEntity(row) : null;
    }

    async findOpenBySessionId(sessionId: string): Promise<StoredTurn | null> {
        const row = await this.repo.findOne({
            where: { sessionId, status: "open" },
            order: { turnIndex: "DESC" },
        });
        return row ? mapEntity(row) : null;
    }

    async countBySessionId(sessionId: string): Promise<number> {
        return this.repo.count({ where: { sessionId } });
    }

    async findEventsForTurn(turnId: string): Promise<readonly string[]> {
        const rows = await this.eventRepo
            .createQueryBuilder("te")
            .innerJoin("timeline_events_view", "e", "e.id = te.event_id")
            .where("te.turn_id = :turnId", { turnId })
            .orderBy("e.created_at", "ASC")
            .select("te.event_id", "eventId")
            .getRawMany<{ eventId: string }>();
        return rows.map((row) => row.eventId);
    }

    async closeTurn(turnId: string, assistantText: string, endedAt: string): Promise<void> {
        await this.repo.update({ id: turnId }, { status: "closed", assistantText, endedAt });
    }

    async forceCloseTurn(turnId: string, endedAt: string): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .update(TurnEntity)
            .set({ status: "closed", endedAt })
            .where("id = :turnId AND status = 'open'", { turnId })
            .execute();
    }

    async updateAggregateVerdict(turnId: string, verdict: TurnAggregateVerdict): Promise<void> {
        await this.repo.update({ id: turnId }, { aggregateVerdict: verdict });
    }

    async updateRulesEvaluatedCount(turnId: string, count: number): Promise<void> {
        await this.repo.update({ id: turnId }, { rulesEvaluatedCount: count });
    }
}

function mapEntity(row: TurnEntity): StoredTurn {
    return {
        id: row.id,
        sessionId: row.sessionId,
        taskId: row.taskId,
        turnIndex: row.turnIndex,
        status: row.status,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        askedText: row.askedText,
        assistantText: row.assistantText,
        aggregateVerdict: row.aggregateVerdict,
        rulesEvaluatedCount: row.rulesEvaluatedCount,
    };
}
